import { detectBankTemplate, normalizeRow, getTemplateById } from './bank-templates';

describe('BankTemplates', () => {
  describe('detectBankTemplate', () => {
    it('should detect KCB template from KCB headers', () => {
      const headers = ['Transaction Date', 'Value Date', 'Debit (KSH)', 'Credit (KSH)', 'Balance (KSH)', 'Details'];
      const template = detectBankTemplate(headers);
      expect(template).not.toBeNull();
      expect(template!.id).toBe('kcb');
      expect(template!.name).toBe('KCB Bank Statement');
    });

    it('should detect KCB with minimum required headers', () => {
      const headers = ['Value Date', 'Balance (KSH)', 'Details'];
      const template = detectBankTemplate(headers);
      expect(template).not.toBeNull();
      expect(template!.id).toBe('kcb');
    });

    it('should detect Equity template from Equity headers', () => {
      const headers = ['Date', 'Description', 'DR (KSH)', 'CR (KSH)', 'Amount (KSH)'];
      const template = detectBankTemplate(headers);
      expect(template).not.toBeNull();
      expect(template!.id).toBe('equity');
    });

    it('should detect Co-operative template from Co-op headers', () => {
      const headers = ['Date', 'Ref No', 'Description', 'Debit (KSH)', 'Credit (KSH)', 'Branch'];
      const template = detectBankTemplate(headers);
      expect(template).not.toBeNull();
      expect(template!.id).toBe('cooperative');
    });

    it('should detect M-Pesa template from M-Pesa headers', () => {
      const headers = ['Receipt No', 'Transaction Date', 'Paid In', 'Withdrawn', 'Balance', 'Status'];
      const template = detectBankTemplate(headers);
      expect(template).not.toBeNull();
      expect(template!.id).toBe('mpesa');
    });

    it('should return null for unrecognized headers', () => {
      const headers = ['Column1', 'Column2', 'Column3'];
      const template = detectBankTemplate(headers);
      expect(template).toBeNull();
    });

    it('should return null for empty headers', () => {
      const template = detectBankTemplate([]);
      expect(template).toBeNull();
    });

    it('should match case-insensitively', () => {
      const headers = ['transaction date', 'value date', 'balance (ksh)', 'details'];
      const template = detectBankTemplate(headers);
      expect(template).not.toBeNull();
      expect(template!.id).toBe('kcb');
    });
  });

  describe('normalizeRow with KCB template', () => {
    const kcbTemplate = getTemplateById('kcb')!;

    it('should normalize a KCB debit row', () => {
      const rawRow = {
        'transaction date': '2026-06-15',
        'debit': '5,000.00',
        'credit': '',
        'balance': '50,000.00',
        'details': 'POS Purchase',
      };
      const result = normalizeRow(kcbTemplate, rawRow);
      expect(result.description).toBe('POS Purchase');
      expect(result.amount).toBe(5000);
      expect(result.paidIn).toBe(0);
      expect(result.withdrawn).toBe(5000);
      expect(result.transactionType).toBe('DEBIT');
      expect(result.receiptNo).toBeNull();
    });

    it('should normalize a KCB credit row', () => {
      const rawRow = {
        'transaction date': '2026-06-16',
        'debit': '',
        'credit': '10,000.00',
        'balance': '60,000.00',
        'details': 'Salary Deposit',
      };
      const result = normalizeRow(kcbTemplate, rawRow);
      expect(result.description).toBe('Salary Deposit');
      expect(result.amount).toBe(10000);
      expect(result.paidIn).toBe(10000);
      expect(result.withdrawn).toBe(0);
      expect(result.transactionType).toBe('CREDIT');
    });

    it('should handle empty description', () => {
      const rawRow = {
        'transaction date': '2026-06-17',
        'debit': '1,000.00',
        'credit': '',
        'balance': '59,000.00',
        'details': '',
      };
      const result = normalizeRow(kcbTemplate, rawRow);
      expect(result.description).toBe('');
      expect(result.amount).toBe(1000);
    });
  });

  describe('normalizeRow with Equity template', () => {
    const equityTemplate = getTemplateById('equity')!;

    it('should normalize an Equity row with DR/CR columns', () => {
      const rawRow = {
        'date': '2026-06-15',
        'description': 'ATM Withdrawal',
        'dr': '3,000.00',
        'cr': '',
      };
      const result = normalizeRow(equityTemplate, rawRow);
      expect(result.description).toBe('ATM Withdrawal');
      expect(result.withdrawn).toBe(3000);
      expect(result.paidIn).toBe(0);
      expect(result.transactionType).toBe('DEBIT');
    });

    it('should handle single Amount column', () => {
      const rawRow = {
        'date': '2026-06-15',
        'description': 'Deposit',
        'amount': '15,000.00',
      };
      const result = normalizeRow(equityTemplate, rawRow);
      expect(result.amount).toBe(15000);
    });
  });

  describe('normalizeRow with M-Pesa template', () => {
    const mpesaTemplate = getTemplateById('mpesa')!;

    it('should normalize an M-Pesa row', () => {
      const rawRow = {
        'receiptno': 'RCT123',
        'transactiondate': '2026-06-15',
        'paidin': '2,000.00',
        'withdrawn': '0',
        'customer': 'John Doe',
        'phonenumber': '0712345678',
        'transactiontype': 'PAYBILL',
      };
      const result = normalizeRow(mpesaTemplate, rawRow);
      expect(result.receiptNo).toBe('RCT123');
      expect(result.paidIn).toBe(2000);
      expect(result.withdrawn).toBe(0);
      expect(result.customerName).toBe('John Doe');
      expect(result.phoneNumber).toBe('0712345678');
      expect(result.transactionType).toBe('PAYBILL');
    });
  });

  describe('getTemplateById', () => {
    it('should return KCB template by id', () => {
      const template = getTemplateById('kcb');
      expect(template).not.toBeUndefined();
      expect(template!.id).toBe('kcb');
    });

    it('should return undefined for unknown id', () => {
      const template = getTemplateById('unknown-bank');
      expect(template).toBeUndefined();
    });
  });
});
