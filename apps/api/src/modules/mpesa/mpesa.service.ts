import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MpesaRepository } from '../../prisma/repositories/mpesa.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { HitlService } from '../hitl/hitl.service';
import { ReconciliationAgent } from '../ai/agents/reconciliation.agent';
import { DarajaService, C2BWebhookPayload, TransactionStatusWebhookPayload } from './daraja.service';
import { detectBankTemplate, normalizeRow } from './bank-templates';

@Injectable()
export class MpesaService {
  private readonly logger = new Logger(MpesaService.name);

  constructor(
    private readonly mpesaRepo: MpesaRepository,
    private readonly prisma: PrismaService,
    private readonly gamificationService: GamificationService,
    private readonly hitlService: HitlService,
    private readonly reconciliationAgent: ReconciliationAgent,
    private readonly darajaService: DarajaService,
  ) { }

  async uploadCsv(companyId: string, userId: string, csvData: string) {
    // Parse CSV rows
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      throw new BadRequestException('CSV must have a header row and at least one data row');
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const rawHeaders = lines[0].split(',').map((h) => h.trim());

    // Try to detect bank template from headers
    const bankTemplate = detectBankTemplate(headers);
    if (bankTemplate) {
      this.logger.log(`Detected bank template: ${bankTemplate.name} (${bankTemplate.id})`);
    }

    const parsedRows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      if (values.length !== headers.length) continue;

      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx];
      });

      if (bankTemplate) {
        // Use bank template to normalize columns
        const normalized = normalizeRow(bankTemplate, row);
        parsedRows.push({
          companyId,
          ...normalized,
          rawCsv: JSON.stringify(row),
        });
      } else {
        // Fall back to alias-based parsing
        parsedRows.push({
          companyId,
          receiptNo: row['receipt'] || row['receiptno'] || row['transaction id'] || null,
          transactionDate: new Date(row['date'] || row['transactiondate'] || row['time'] || Date.now()),
          description: row['description'] || row['details'] || row['notes'] || '',
          amount: parseFloat(row['amount'] || row['value'] || '0'),
          paidIn: parseFloat(row['paid in'] || row['paidin'] || '0') || 0,
          withdrawn: parseFloat(row['withdrawn'] || '0') || 0,
          phoneNumber: row['phone'] || row['phonenumber'] || row['sender'] || null,
          paybill: row['paybill'] || row['business'] || row['till'] || null,
          customerName: row['customer name'] || row['customer'] || undefined,
          transactionType: row['transaction type'] || row['transactiontype'] || undefined,
          rawCsv: JSON.stringify(row),
        });
      }
    }

    if (parsedRows.length === 0) {
      throw new BadRequestException('No valid transactions found in CSV');
    }

    // Bulk insert using createManyAndReturn to get back the created records with their IDs
    const transactions = await this.prisma.mpesaTransaction.createManyAndReturn({
      data: parsedRows,
    });

    // Auto-categorize using rules (transactions now have real IDs from the DB)
    const categorized = await this.autoCategorize(companyId, transactions);

    // Award XP for importing M-Pesa transactions
    const xpAmount = Math.min(transactions.length * 2, 25); // 2 XP per tx, max 25
    if (transactions.length > 0 && userId) {
      await this.gamificationService.awardXp(
        userId,
        companyId,
        xpAmount,
        `Imported ${transactions.length} M-Pesa transactions`,
      ).catch(() => { });
    }

    return {
      imported: transactions.length,
      categorized: categorized.length,
      message: `Successfully imported ${transactions.length} M-Pesa transactions`,
    };
  }

  async bulkCreate(companyId: string, userId: string, transactions: Array<{
    transactionDate: Date;
    description: string;
    amount: number;
    paidIn: number;
    withdrawn: number;
    phoneNumber?: string;
    receiptNo?: string;
    paybill?: string;
    customerName?: string;
    transactionType?: string;
  }>, source: string) {
    const receiptNos = transactions
      .map(t => t.receiptNo)
      .filter((r): r is string => !!r);

    // Check if ALL transactions might be duplicates before entering the serializable transaction
    // (This early check is an optimization to avoid unnecessary serializable transactions)
    let existingReceipts = new Set<string>();
    if (receiptNos.length > 0) {
      const existing = await this.prisma.mpesaTransaction.findMany({
        where: { companyId, receiptNo: { in: receiptNos } },
        select: { receiptNo: true },
      });
      existing.forEach(t => { if (t.receiptNo) existingReceipts.add(t.receiptNo); });
    }

    const initialFiltered = transactions.filter(t => !t.receiptNo || !existingReceipts.has(t.receiptNo));
    let duplicates = transactions.length - initialFiltered.length;

    if (initialFiltered.length === 0) {
      return { imported: 0, categorized: 0, duplicates, source, message: `All ${duplicates} transactions were already imported` };
    }

    // Use serializable transaction to prevent race conditions from concurrent uploads
    const result = await this.prisma.$transaction(async (tx) => {
      // Re-check inside the transaction to prevent race conditions
      const txExistingReceipts = new Set<string>();
      if (receiptNos.length > 0) {
        const existing = await tx.mpesaTransaction.findMany({
          where: { companyId, receiptNo: { in: receiptNos } },
          select: { receiptNo: true },
        });
        existing.forEach(t => { if (t.receiptNo) txExistingReceipts.add(t.receiptNo); });
      }

      const newTx = transactions.filter(t => !t.receiptNo || !txExistingReceipts.has(t.receiptNo));
      const txDuplicates = transactions.length - newTx.length;

      if (newTx.length === 0) {
        return { created: null as any, txDuplicates };
      }

      const parsedRows = newTx.map((tx) => ({
        companyId,
        receiptNo: tx.receiptNo || null,
        transactionDate: tx.transactionDate,
        description: tx.description,
        amount: tx.amount,
        paidIn: tx.paidIn || 0,
        withdrawn: tx.withdrawn || 0,
        phoneNumber: tx.phoneNumber || null,
        paybill: tx.paybill || null,
        customerName: tx.customerName || null,
        transactionType: tx.transactionType || null,
        rawCsv: JSON.stringify({ source, ...tx }),
      }));

      const created = await tx.mpesaTransaction.createManyAndReturn({
        data: parsedRows,
      });

      return { created, txDuplicates };
    }, { isolationLevel: 'Serializable' });

    duplicates = result.txDuplicates;
    const created = result.created;

    // Auto-categorize using rules
    const categorized = await this.autoCategorize(companyId, created, userId);

    // Award XP
    const xpAmount = Math.min(created.length * 2, 25);
    if (created.length > 0 && userId) {
      await this.gamificationService.awardXp(userId, companyId, xpAmount, `Imported ${created.length} transactions from ${source}`)
        .catch(() => { });
    }

    const parts = [`Successfully imported ${created.length} transactions from ${source}`];
    if (duplicates > 0) parts.push(`${duplicates} duplicates skipped`);
    return {
      imported: created.length,
      categorized: categorized.length,
      duplicates,
      source,
      message: parts.join('. '),
    };
  }

  async batchCategorize(ids: string[], accountId: string) {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('No transaction IDs provided');
    }

    let successCount = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const id of ids) {
      try {
        await this.mapToAccount(id, accountId);
        successCount++;
      } catch (err: any) {
        errors.push({ id, error: err.message });
        this.logger.warn(`batchCategorize failed for tx ${id}: ${err.message}`);
      }
    }

    return {
      total: ids.length,
      successCount,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async deleteTransactions(companyId: string, receiptNos: string[]) {
    if (receiptNos.length === 0) return { deleted: 0 };
    // Fetch IDs of transactions being deleted (needed for HITL cascade)
    const toDelete = await this.prisma.mpesaTransaction.findMany({
      where: { companyId, receiptNo: { in: receiptNos } },
      select: { id: true },
    });
    const ids = toDelete.map(t => t.id);
    // Cascade-delete associated HITL pending reviews
    if (ids.length > 0) {
      await this.prisma.pendingReview.deleteMany({
        where: { companyId, linkedEntityType: 'MPESA_TX', linkedEntityId: { in: ids } },
      });
    }
    const result = await this.prisma.mpesaTransaction.deleteMany({
      where: { companyId, receiptNo: { in: receiptNos } },
    });
    return { deleted: result.count };
  }

  async deleteAllTransactions(companyId: string) {
    // Cascade-delete associated HITL pending reviews first
    await this.prisma.pendingReview.deleteMany({
      where: { companyId, linkedEntityType: 'MPESA_TX' },
    });
    const result = await this.prisma.mpesaTransaction.deleteMany({
      where: { companyId },
    });
    return { deleted: result.count };
  }

  async findTransactions(companyId: string, filters?: {
    isReconciled?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 200; // Show up to 200 per page by default
    const skip = (page - 1) * limit;

    const where: any = { companyId };
    if (filters?.isReconciled !== undefined) {
      where.isReconciled = filters.isReconciled;
    }

    const [items, total] = await Promise.all([
      this.prisma.mpesaTransaction.findMany({
        where,
        include: { mappedAccount: { select: { id: true, code: true, name: true } } },
        orderBy: { transactionDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.mpesaTransaction.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async mapToAccount(transactionId: string, accountId: string) {
    const transaction = await this.prisma.mpesaTransaction.findUnique({
      where: { id: transactionId },
    });
    if (!transaction) {
      throw new BadRequestException(`Transaction ${transactionId} not found`);
    }

    const account = await this.prisma.chartOfAccount.findFirst({
      where: { id: accountId, companyId: transaction.companyId },
    });
    if (!account) {
      throw new BadRequestException(`Account ${accountId} not found in this company`);
    }

    return this.prisma.mpesaTransaction.update({
      where: { id: transactionId },
      data: { mappedAccountId: accountId, isReconciled: true },
      include: { mappedAccount: true },
    });
  }

  /**
   * Resolves the company ID from a Daraja BusinessShortCode (paybill/till number).
   * Since webhooks don't carry tenant context, we map the shortcode to a company.
   * Falls back to first company found or env-configured default.
   */
  private async resolveCompanyFromShortcode(shortcode: string): Promise<string> {
    // Try to find a company that has this shortcode configured
    // In a multi-tenant setup, multiple companies could share a paybill.
    // We look up by a company metadata field or environment variable.
    const configuredCompanyId = process.env.DEFAULT_COMPANY_ID;
    if (configuredCompanyId) {
      return configuredCompanyId;
    }

    // For single-tenant or dev mode, find the first active company
    const firstCompany = await this.prisma.company.findFirst({
      where: { isActive: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!firstCompany) {
      throw new Error('No active company found for Daraja webhook. Set DEFAULT_COMPANY_ID env var.');
    }

    return firstCompany.id;
  }

  // ─── Daraja Webhook Methods ────────────────────────────────────────────

  /**
   * Checks if a transaction with the given TransID (receiptNo) already exists.
   * Used for idempotency check on incoming webhooks.
   */
  async checkDuplicateTransaction(transId: string): Promise<boolean> {
    if (!transId) return false;

    const existing = await this.prisma.mpesaTransaction.findFirst({
      where: { receiptNo: transId },
      select: { id: true },
    });

    return !!existing;
  }

  /**
   * Processes a C2B payment notification from Safaricom Daraja API.
   * 1. Parses the webhook payload into a transaction
   * 2. Stores it in the database
   * 3. Attempts auto-reconciliation (match BillRefNumber to open invoice)
   * 4. If matched: marks invoice as paid, creates journal entry
   * 5. If not matched: creates unmapped transaction flagged for review
   *
   * TIME-TRAVEL compliant: uses TransTime from webhook, not Date.now()
   */
  async processDarajaTransaction(payload: C2BWebhookPayload): Promise<void> {
    const {
      TransID,
      TransTime,
      TransAmount,
      MSISDN,
      BillRefNumber,
      FirstName,
      MiddleName,
      LastName,
    } = payload;

    // Parse the webhook-provided timestamp
    const transactionDate = this.darajaService.parseTransTime(TransTime);
    const amount = parseFloat(TransAmount) || 0;
    const customerName = [FirstName, MiddleName, LastName].filter(Boolean).join(' ') || MSISDN;

    // Build description
    const description = `M-Pesa: ${payload.TransactionType || 'Payment'} from ${customerName}${BillRefNumber ? ` Ref: ${BillRefNumber}` : ''}`;

    // We need a companyId to create the transaction.
    // Daraja webhooks don't include tenant context directly.
    // Try to find the company by paybill number, or use a config-based default.
    // For now, this requires a configured mapping.
    const companyId = await this.resolveCompanyFromShortcode(payload.BusinessShortCode);

    // Create the transaction record
    // Use receiptNo = TransID for idempotency (we already checked duplicates above)
    const transaction = await this.prisma.mpesaTransaction.create({
      data: {
        companyId,
        receiptNo: TransID,
        transactionDate,
        description,
        amount,
        paidIn: amount, // C2B = money coming in
        withdrawn: 0,
        phoneNumber: MSISDN,
        customerName,
        paybill: payload.BusinessShortCode,
        transactionType: payload.TransactionType || 'C2B',
        rawCsv: JSON.stringify(payload),
        // Not flagged as reconciled yet — will be reconciled below if matched
        isReconciled: false,
      },
    });

    // Auto-reconcile: try to match BillRefNumber against open invoices
    if (BillRefNumber) {
      await this.tryAutoReconcile(transaction.id, transaction.companyId, BillRefNumber, amount, transactionDate);
    } else {
      // No BillRefNumber — this is an unmapped transaction, flag for review
      await this.flagForReview(transaction, 'No BillRefNumber provided');
    }
  }

  /**
   * Attempts to auto-reconcile a Daraja transaction against an open invoice.
   * If BillRefNumber matches an open invoice number:
   *   - Mark invoice as paid
   *   - Create journal entry
   *   - Mark transaction as reconciled
   * If no match: create unmapped transaction flagged for review.
   */
  private async tryAutoReconcile(
    transactionId: string,
    companyId: string,
    billRefNumber: string,
    amount: number,
    transactionDate: Date,
  ): Promise<void> {
    // 1. Try to find an open invoice with matching invoice number
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        companyId,
        invoiceNumber: billRefNumber,
        status: { in: ['DRAFT', 'SENT', 'OVERDUE'] },
      },
    });

    if (!invoice) {
      // 2. No matching invoice — try matching as account code / category rule
      const ruleMatch = await this.tryRuleMatch(companyId, billRefNumber, amount, transactionDate);

      if (!ruleMatch) {
        // 3. No match at all — flag for review
        const tx = await this.prisma.mpesaTransaction.findUnique({
          where: { id: transactionId },
        });
        if (tx) {
          await this.flagForReview(tx, `No matching invoice for BillRefNumber: ${billRefNumber}`);
        }
      }
      return;
    }

    // Invoice found — auto-reconcile
    this.logger.log(`Auto-reconciling Daraja transaction ${transactionId} with invoice ${invoice.invoiceNumber}`);

    // Find the revenue account for invoice payments
    const revenueAccount = await this.prisma.chartOfAccount.findFirst({
      where: {
        companyId,
        type: 'INCOME',
        isActive: true,
      },
      orderBy: { code: 'asc' },
    });

    // Use a suspense account if no revenue account found
    const accountId = revenueAccount?.id || 'suspense-account';

    // Update transaction as reconciled
    await this.prisma.mpesaTransaction.update({
      where: { id: transactionId },
      data: {
        mappedAccountId: accountId,
        isReconciled: true,
        confidence: 0.95,
      },
    });

    // Mark invoice as paid
    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'PAID',
        paidAt: transactionDate,
      },
    });

    // Create journal entry for the payment
    // Debit: accounts_receivable (settled), Credit: income account
    try {
      await this.prisma.journalEntry.create({
        data: {
          companyId,
          accountId,
          description: `M-Pesa payment for Invoice ${invoice.invoiceNumber}: ${billRefNumber}`,
          amount,
          direction: 'CREDIT',
          entryDate: transactionDate,
          postedById: 'system',
          aiConfidence: 0.95,
          aiReasoning: `Auto-reconciled: Daraja TransID matched Invoice ${invoice.invoiceNumber}`,
          reference: billRefNumber,
        },
      });

      // Also create a debit entry for the receivable
      const receivableAccount = await this.prisma.chartOfAccount.findFirst({
        where: { companyId, type: 'ASSET', code: { startsWith: '1' }, isActive: true },
        orderBy: { code: 'asc' },
      });

      if (receivableAccount) {
        await this.prisma.journalEntry.create({
          data: {
            companyId,
            accountId: receivableAccount.id,
            description: `M-Pesa receipt for Invoice ${invoice.invoiceNumber}`,
            amount,
            direction: 'DEBIT',
            entryDate: transactionDate,
            postedById: 'system',
            aiConfidence: 0.95,
            aiReasoning: `Auto-reconciled: Daraja payment for Invoice ${invoice.invoiceNumber}`,
            reference: billRefNumber,
          },
        });
      }
    } catch (journalErr: any) {
      this.logger.error(`Failed to create journal entry for reconciled Daraja tx ${transactionId}: ${journalErr.message}`);
    }
  }

  /**
   * Tries to match a BillRefNumber against an active category rule.
   * Returns true if a match was found and applied.
   */
  private async tryRuleMatch(
    companyId: string,
    billRefNumber: string,
    amount: number,
    transactionDate: Date,
  ): Promise<boolean> {
    // Try matching BillRefNumber against category rule keywords
    const rules = await this.prisma.categoryRule.findMany({
      where: { companyId, isActive: true },
      orderBy: { priority: 'desc' },
    });

    for (const rule of rules) {
      if (billRefNumber.toLowerCase().includes(rule.keyword.toLowerCase())) {
        const account = await this.prisma.chartOfAccount.findUnique({
          where: { companyId_code: { companyId, code: rule.accountCode } },
        });

        if (account) {
          this.logger.log(`Rule-matched Daraja BillRefNumber ${billRefNumber} to account ${account.code}`);

          // Create journal entry
          await this.prisma.journalEntry.create({
            data: {
              companyId,
              accountId: account.id,
              description: `M-Pesa Daraja: ${billRefNumber}`,
              amount,
              direction: account.type === 'INCOME' ? 'CREDIT' : 'DEBIT',
              entryDate: transactionDate,
              postedById: 'system',
              aiConfidence: 0.9,
              aiReasoning: `Rule-matched: BillRefNumber matched category rule "${rule.keyword}"`,
              reference: billRefNumber,
            },
          });

          return true;
        }
      }
    }

    return false;
  }

  /**
   * Flags a transaction for human review (HITL) when auto-reconciliation fails.
   */
  private async flagForReview(transaction: any, reason: string): Promise<void> {
    this.logger.log(`Flagging Daraja transaction ${transaction.id} for review: ${reason}`);

    try {
      await this.hitlService.create(transaction.companyId, {
        category: 'UNMAPPED_DATA',
        description: `M-Pesa Daraja: KES ${transaction.amount} — ${transaction.description || 'No description'} (${reason})`,
        rawData: JSON.stringify(transaction),
        linkedEntityId: transaction.id,
        linkedEntityType: 'MPESA_TX',
        confidence: 0,
      });
    } catch (err: any) {
      this.logger.error(`Failed to create HITL review for Daraja tx ${transaction.id}: ${err.message}`);
    }
  }

  /**
   * Processes a transaction status result from Safaricom.
   * Updates the transaction status based on the result.
   */
  async processTransactionStatusResult(payload: TransactionStatusWebhookPayload): Promise<void> {
    const result = payload.Result;
    if (!result) {
      this.logger.warn('Transaction status webhook missing Result field');
      return;
    }

    const { TransactionID, ResultCode, ResultDesc } = result;

    this.logger.log(`Transaction status result for ${TransactionID}: Code=${ResultCode}, Desc=${ResultDesc}`);

    // Find the transaction by receiptNo (TransID)
    const transaction = await this.prisma.mpesaTransaction.findFirst({
      where: { receiptNo: TransactionID },
    });

    if (!transaction) {
      this.logger.warn(`Transaction status result for unknown TransID: ${TransactionID}`);
      return;
    }

    // Extract optional result parameters
    let resultParams: Record<string, string> = {};
    if (result.ResultParameters?.ResultParameter) {
      for (const param of result.ResultParameters.ResultParameter) {
        resultParams[param.Key] = param.Value;
      }
    }

    // Update the transaction with status information
    // Store the result data in rawCsv (preserve existing data)
    const existingRaw = transaction.rawCsv ? JSON.parse(transaction.rawCsv) : {};
    await this.prisma.mpesaTransaction.update({
      where: { id: transaction.id },
      data: {
        rawCsv: JSON.stringify({
          ...existingRaw,
          transactionStatus: {
            resultCode: ResultCode,
            resultDesc: ResultDesc,
            resultParams,
            checkedAt: transaction.transactionDate,
          },
        }),
      },
    });

    // If the transaction was completed, mark as reconciled
    if (ResultCode === 0) {
      this.logger.log(`Transaction ${TransactionID} confirmed completed`);
    }
  }

  // ─── Daraja Sync ───────────────────────────────────────────────────────

  /**
   * Pulls transaction status from Daraja API for a specific M-Pesa transaction.
   * This is used for on-demand status checks from the frontend.
   */
  async pullTransactionStatus(transactionId: string): Promise<any> {
    const transaction = await this.prisma.mpesaTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new BadRequestException(`Transaction ${transactionId} not found`);
    }

    if (!transaction.receiptNo) {
      throw new BadRequestException('Transaction has no receipt number for Daraja lookup');
    }

    if (!this.darajaService.isConfigured) {
      throw new BadRequestException('Daraja API is not configured');
    }

    return this.darajaService.queryTransactionStatus(transaction.receiptNo);
  }

  /**
   * Syncs recent M-Pesa transactions from Daraja API.
   * Queries transactions by a list of receipt numbers.
   */
  async syncFromDaraja(companyId: string, receiptNos: string[]): Promise<{
    queried: number;
    results: Array<{ receiptNo: string; status: string }>;
  }> {
    if (!this.darajaService.isConfigured) {
      throw new BadRequestException('Daraja API is not configured');
    }

    const results: Array<{ receiptNo: string; status: string }> = [];

    for (const receiptNo of receiptNos) {
      try {
        const status = await this.darajaService.queryTransactionStatus(receiptNo);
        const resultCode = status.Result?.ResultCode;
        results.push({
          receiptNo,
          status: resultCode === 0 ? 'COMPLETED' : resultCode === 1 ? 'PENDING' : 'FAILED',
        });
      } catch (err: any) {
        this.logger.warn(`Failed to query Daraja status for ${receiptNo}: ${err.message}`);
        results.push({ receiptNo, status: 'QUERY_FAILED' });
      }
    }

    return {
      queried: receiptNos.length,
      results,
    };
  }

  // ─── Private Helpers ───────────────────────────────────────────────────

  private async autoCategorize(companyId: string, transactions: any[], userId?: string) {
    const rules = await this.prisma.categoryRule.findMany({
      where: { companyId, isActive: true },
      orderBy: { priority: 'desc' },
    });

    const categorized: string[] = [];

    for (const tx of transactions) {
      const matchingRule = rules.find((rule) =>
        tx.description.toLowerCase().includes(rule.keyword.toLowerCase()),
      );

      if (matchingRule) {
        const account = await this.prisma.chartOfAccount.findUnique({
          where: { companyId_code: { companyId, code: matchingRule.accountCode } },
        });

        if (account) {
          await this.prisma.mpesaTransaction.updateMany({
            where: { id: tx.id || 'none' },
            data: {
              mappedAccountId: account.id,
              category: matchingRule.keyword,
              isReconciled: true,
              confidence: 0.95, // Rule-based = high confidence
            },
          });
          categorized.push(tx.id);
        }
      }
    }

    // For unmapped transactions, try AI reconciliation agent
    const unmappedTxns = transactions.filter((tx) => !categorized.includes(tx.id));

    for (const tx of unmappedTxns) {
      try {
        const aiResult = await this.reconciliationAgent.reconcile({
          companyId,
          description: tx.description || '',
          amount: tx.amount || 0,
          reference: tx.receiptNo || '',
        });

        if (aiResult.confidence >= 0.7 && aiResult.accountId !== 'suspense-account') {
          // AI confidence >= 0.7: auto-map the transaction
          const account = await this.prisma.chartOfAccount.findUnique({
            where: { companyId_code: { companyId, code: aiResult.accountId } },
          });

          if (account) {
            await this.prisma.mpesaTransaction.updateMany({
              where: { id: tx.id },
              data: {
                mappedAccountId: account.id,
                isReconciled: true,
                confidence: aiResult.confidence,
              },
            });
            categorized.push(tx.id);
            this.logger.log(`AI auto-mapped tx ${tx.id} to account ${account.code} (confidence: ${aiResult.confidence})`);

            // Auto-post: If confidence >= 0.9, auto-create journal entry
            if (aiResult.confidence >= 0.9 && tx.amount && tx.description) {
              try {
                const direction = account.type === 'INCOME' ? 'CREDIT' :
                  account.type === 'EXPENSE' || account.type === 'ASSET' ? 'DEBIT' : 'CREDIT';

                await this.prisma.journalEntry.create({
                  data: {
                    companyId,
                    accountId: account.id,
                    description: `AI-auto: ${tx.description}`,
                    amount: tx.amount,
                    direction,
                    entryDate: tx.transactionDate || new Date(),
                    postedById: userId || 'system',
                    aiConfidence: aiResult.confidence,
                    aiReasoning: aiResult.reasoning,
                    reference: tx.receiptNo || null,
                    serialNumber: `AI-${Date.now().toString(36).toUpperCase()}`,
                  },
                });
                this.logger.log(`Auto-posted journal entry for tx ${tx.id} (confidence: ${aiResult.confidence})`);
              } catch (journalError: any) {
                this.logger.error(`Failed to auto-post journal entry for tx ${tx.id}: ${journalError.message}`);
              }
            }

            continue; // Skip HITL creation for this tx
          }
        }

        // Low confidence or no account: send to HITL with AI reasoning
        await this.hitlService.create(companyId, {
          category: 'UNMAPPED_DATA',
          description: `M-Pesa: KES ${tx.amount} — ${tx.description || 'No description'}`,
          rawData: JSON.stringify({ ...tx, aiReasoning: aiResult.reasoning }),
          linkedEntityId: tx.id,
          linkedEntityType: 'MPESA_TX',
          confidence: aiResult.confidence || 0,
        }).catch(() => { });
      } catch (aiError: any) {
        // AI agent failed: fall back to basic HITL creation
        this.logger.warn(`AI agent failed for tx ${tx.id}: ${aiError.message}`);
        await this.hitlService.create(companyId, {
          category: 'UNMAPPED_DATA',
          description: `M-Pesa: KES ${tx.amount} — ${tx.description || 'No description'}`,
          rawData: JSON.stringify(tx),
          linkedEntityId: tx.id,
          linkedEntityType: 'MPESA_TX',
          confidence: 0,
        }).catch(() => { });
      }
    }

    return categorized;
  }
}
