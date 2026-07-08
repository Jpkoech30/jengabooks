/**
 * Bank CSV Templates for Kenyan Banks
 *
 * Maps column headers from various Kenyan bank statement CSVs
 * to the normalized format expected by MpesaService.
 *
 * Supported banks:
 * - KCB (Kenya Commercial Bank)
 * - Equity Bank
 * - Co-operative Bank
 * - Standard M-Pesa statement
 */

export interface BankTemplate {
  id: string;
  name: string;
  /** Keywords to detect in the header row (lowercase) */
  headerPattern: string[];
  /** Map raw header name → normalized field. Keys are lowercase. */
  columnMap: Record<string, string>;
  /** Transform a parsed row into MpesaService-compatible format */
  transform: (row: Record<string, string>) => {
    receiptNo: string | null;
    transactionDate: Date;
    description: string;
    amount: number;
    paidIn: number;
    withdrawn: number;
    phoneNumber: string | null;
    paybill: string | null;
    customerName?: string;
    transactionType?: string;
  };
}

/**
 * Detect which bank template matches a set of CSV headers.
 * Returns the first matching template, or `null` if no match.
 */
export function detectBankTemplate(headers: string[]): BankTemplate | null {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

  // Score each template by counting matching header keywords
  let bestMatch: BankTemplate | null = null;
  let bestScore = 0;

  for (const template of TEMPLATES) {
    let score = 0;
    for (const pattern of template.headerPattern) {
      if (lowerHeaders.some((h) => h.includes(pattern))) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = template;
    }
  }

  // Require at least 2 matching patterns to consider it a match
  return bestScore >= 2 ? bestMatch : null;
}

/**
 * Normalize a row using the detected bank template into
 * the standard format expected by MpesaService.
 */
export function normalizeRow(
  template: BankTemplate,
  rawRow: Record<string, string>,
): ReturnType<BankTemplate['transform']> {
  // Remap raw column names to normalized names
  const normalized: Record<string, string> = {};
  for (const [rawKey, value] of Object.entries(rawRow)) {
    const mappedKey = template.columnMap[rawKey.toLowerCase()] || rawKey;
    normalized[mappedKey] = value;
  }

  return template.transform(normalized);
}

// ─── Template Definitions ──────────────────────────────────────────────────

/** Strip non-numeric characters (commas, spaces) for parsing */
function parseNumeric(value: string | undefined): number {
  if (!value) return 0;
  return parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
}

const MpesaTemplate: BankTemplate = {
  id: 'mpesa',
  name: 'M-Pesa Statement',
  headerPattern: ['receipt', 'paid in', 'withdrawn', 'balance'],
  columnMap: {
    'receipt no': 'receiptNo',
    'receiptno': 'receiptNo',
    'transaction id': 'receiptNo',
    'transaction date': 'transactionDate',
    'transactiondate': 'transactionDate',
    'paid in': 'paidIn',
    'paidin': 'paidIn',
    'withdrawn': 'withdrawn',
    'phone number': 'phoneNumber',
    'phonenumber': 'phoneNumber',
    'customer name': 'customerName',
    'customer': 'customerName',
    'transaction type': 'transactionType',
    'transactiontype': 'transactionType',
  },
  transform: (row) => ({
    receiptNo: row.receiptNo || null,
    transactionDate: new Date(row.transactionDate || row.date || Date.now()),
    description: row.description || row.details || row.notes || '',
    amount: parseNumeric(row.amount || row.value),
    paidIn: parseNumeric(row.paidIn),
    withdrawn: parseNumeric(row.withdrawn),
    phoneNumber: row.phoneNumber || row.phone || row.sender || null,
    paybill: row.paybill || row.business || row.till || null,
    customerName: row.customerName || undefined,
    transactionType: row.transactionType || undefined,
  }),
};

const KcbTemplate: BankTemplate = {
  id: 'kcb',
  name: 'KCB Bank Statement',
  headerPattern: ['value date', 'balance (ksh)', 'details', 'kcb'],
  columnMap: {
    'transaction date': 'transactionDate',
    'value date': 'transactionDate',
    'debit (ksh)': 'debit',
    'debit': 'debit',
    'credit (ksh)': 'credit',
    'credit': 'credit',
    'balance (ksh)': 'balance',
    'balance': 'balance',
    'transaction details': 'description',
    'details': 'description',
    'narration': 'description',
    'reference': 'reference',
    'ref no': 'reference',
    'refno': 'reference',
  },
  transform: (row) => {
    const debit = parseNumeric(row.debit);
    const credit = parseNumeric(row.credit);
    const amount = debit > 0 ? debit : credit;
    return {
      receiptNo: row.reference || null,
      transactionDate: new Date(row.transactionDate || Date.now()),
      description: row.description || '',
      amount,
      paidIn: credit,
      withdrawn: debit,
      phoneNumber: null,
      paybill: null,
      transactionType: debit > 0 ? 'DEBIT' : credit > 0 ? 'CREDIT' : undefined,
    };
  },
};

const EquityTemplate: BankTemplate = {
  id: 'equity',
  name: 'Equity Bank Statement',
  headerPattern: ['equity', 'dr', 'cr', 'amount (ksh)'],
  columnMap: {
    'transaction date': 'transactionDate',
    'value date': 'transactionDate',
    'date': 'transactionDate',
    'dr (ksh)': 'debit',
    'dr': 'debit',
    'cr (ksh)': 'credit',
    'cr': 'credit',
    'amount (ksh)': 'amount',
    'amount': 'amount',
    'details': 'description',
    'description': 'description',
    'narration': 'description',
    'reference': 'reference',
    'ref no': 'reference',
    'refno': 'reference',
    'transaction code': 'reference',
    'trans code': 'reference',
  },
  transform: (row) => {
    // Equity sometimes uses Amount column (single), sometimes DR/CR columns
    const amountRaw = parseNumeric(row.amount);
    const debit = parseNumeric(row.debit);
    const credit = parseNumeric(row.credit);

    let paidIn = 0;
    let withdrawn = 0;
    let amount = 0;

    if (amountRaw > 0 && debit === 0 && credit === 0) {
      // Single Amount column — can't tell direction; default to zero
      // User will need to categorize manually
      amount = amountRaw;
    } else {
      paidIn = credit || (amountRaw > 0 ? amountRaw : 0);
      withdrawn = debit || (amountRaw < 0 ? Math.abs(amountRaw) : 0);
      amount = paidIn > 0 ? paidIn : withdrawn;
    }

    return {
      receiptNo: row.reference || null,
      transactionDate: new Date(row.transactionDate || Date.now()),
      description: row.description || '',
      amount,
      paidIn,
      withdrawn,
      phoneNumber: null,
      paybill: null,
      transactionType:
        withdrawn > 0 ? 'DEBIT' : paidIn > 0 ? 'CREDIT' : undefined,
    };
  },
};

const CooperativeTemplate: BankTemplate = {
  id: 'cooperative',
  name: 'Co-operative Bank Statement',
  headerPattern: ['co-op', 'cooperative', 'coop', 'ref no', 'branch'],
  columnMap: {
    'transaction date': 'transactionDate',
    'value date': 'transactionDate',
    'date': 'transactionDate',
    'ref no': 'reference',
    'refno': 'reference',
    'reference': 'reference',
    'debit (ksh)': 'debit',
    'debit': 'debit',
    'credit (ksh)': 'credit',
    'credit': 'credit',
    'details': 'description',
    'description': 'description',
    'transaction details': 'description',
    'narration': 'description',
    'branch': 'branch',
  },
  transform: (row) => {
    const debit = parseNumeric(row.debit);
    const credit = parseNumeric(row.credit);
    const amount = debit > 0 ? debit : credit;

    return {
      receiptNo: row.reference || null,
      transactionDate: new Date(row.transactionDate || Date.now()),
      description: row.description || '',
      amount,
      paidIn: credit,
      withdrawn: debit,
      phoneNumber: null,
      paybill: null,
      transactionType: debit > 0 ? 'DEBIT' : credit > 0 ? 'CREDIT' : undefined,
    };
  },
};

/** All registered bank templates */
export const TEMPLATES: BankTemplate[] = [
  MpesaTemplate,
  KcbTemplate,
  EquityTemplate,
  CooperativeTemplate,
];

/** Get a template by its ID */
export function getTemplateById(id: string): BankTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
