import { Controller, Post, Body, Headers, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { MpesaService } from './mpesa.service';
import { DarajaService, C2BWebhookPayload, TransactionStatusWebhookPayload } from './daraja.service';

/**
 * Webhook controller for M-Pesa Daraja API callbacks.
 * These endpoints are PUBLIC (no JWT auth) because Safaricom
 * calls them directly with their own authentication (signature validation).
 */
@Controller('mpesa/webhook')
export class MpesaWebhookController {
  private readonly logger = new Logger(MpesaWebhookController.name);

  constructor(
    private readonly mpesaService: MpesaService,
    private readonly darajaService: DarajaService,
  ) {}

  /**
   * C2B (Customer to Business) payment notification from Safaricom.
   * Safaricom sends this when a customer sends money to the paybill/till.
   *
   * Expected payload:
   * {
   *   TransactionType: "CustomerPayBillOnline",
   *   TransID: "NFK9Q1K4C8",
   *   TransTime: "20260708220000",
   *   TransAmount: "1500.00",
   *   BusinessShortCode: "174379",
   *   BillRefNumber: "INV-001",
   *   MSISDN: "254712345678",
   *   FirstName: "John",
   *   LastName: "Doe"
   * }
   */
  @Post('c2b')
  @HttpCode(HttpStatus.OK)
  async handleC2BNotification(
    @Body() payload: C2BWebhookPayload,
    @Headers('X-Safaricom-Signature') signatureHeader?: string,
  ): Promise<{ ResultCode: number; ResultDesc: string }> {
    this.logger.log(`C2B webhook received: TransID=${payload.TransID}, Amount=${payload.TransAmount}`);

    // 1. Validate webhook signature
    if (!this.darajaService.validateWebhookSignature(payload, signatureHeader)) {
      this.logger.warn(`Invalid webhook signature for TransID: ${payload.TransID}`);
      return {
        ResultCode: 1,
        ResultDesc: 'Invalid signature',
      };
    }

    // 2. Idempotency check — skip if TransID already exists
    const isDuplicate = await this.mpesaService.checkDuplicateTransaction(payload.TransID);
    if (isDuplicate) {
      this.logger.log(`Duplicate webhook TransID: ${payload.TransID} — skipping`);
      return {
        ResultCode: 0,
        ResultDesc: 'Duplicate — already processed',
      };
    }

    try {
      // 3. Process the transaction (store + auto-reconcile)
      await this.mpesaService.processDarajaTransaction(payload);

      return {
        ResultCode: 0,
        ResultDesc: 'Success',
      };
    } catch (err: any) {
      this.logger.error(`Failed to process C2B webhook TransID=${payload.TransID}: ${err.message}`);
      // Return success to Safaricom (they will retry if we return non-zero)
      // We handle the error internally via retry queues
      return {
        ResultCode: 0,
        ResultDesc: 'Accepted for processing',
      };
    }
  }

  /**
   * Validation endpoint for C2B payments.
   * Safaricom calls this BEFORE processing the transaction.
   * We return ResultCode: 0 to accept all transactions.
   */
  @Post('c2b/validation')
  @HttpCode(HttpStatus.OK)
  validateC2BRequest(@Body() payload: any): { ResultCode: number; ResultDesc: string } {
    this.logger.log(`C2B validation request received`);
    return this.darajaService.validateC2BRequest(payload);
  }

  /**
   * Transaction status result from Safaricom.
   * Called after a transaction status query is processed.
   */
  @Post('transaction-status')
  @HttpCode(HttpStatus.OK)
  async handleTransactionStatus(
    @Body() payload: TransactionStatusWebhookPayload,
  ): Promise<{ ResultCode: number; ResultDesc: string }> {
    this.logger.log(`Transaction status webhook received: TransactionID=${payload.Result?.TransactionID}`);

    try {
      await this.mpesaService.processTransactionStatusResult(payload);

      return {
        ResultCode: 0,
        ResultDesc: 'Success',
      };
    } catch (err: any) {
      this.logger.error(`Failed to process transaction status webhook: ${err.message}`);
      return {
        ResultCode: 0,
        ResultDesc: 'Accepted',
      };
    }
  }

  /**
   * Confirmation endpoint for B2C (Business to Customer) payments.
   * Called when sending money from business to customer.
   */
  @Post('b2c/result')
  @HttpCode(HttpStatus.OK)
  async handleB2CResult(@Body() payload: any): Promise<{ ResultCode: number; ResultDesc: string }> {
    this.logger.log(`B2C result webhook received`);
    // For now, acknowledge receipt. Full B2C support in future sprint.
    return {
      ResultCode: 0,
      ResultDesc: 'Success',
    };
  }
}
