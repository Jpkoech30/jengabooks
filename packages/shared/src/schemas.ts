import { z } from 'zod';

/**
 * Validate a KRA PIN (Kenya Revenue Authority Personal Identification Number)
 * Format: 11 characters, uppercase alphanumeric, must contain at least one digit
 * Example: P051234567Z
 */
export function isValidKraPin(pin: string | null | undefined): boolean {
  if (!pin) return false;
  return /^[A-Z0-9]{11}$/.test(pin) && /[0-9]/.test(pin);
}

import { CompanyRole, FiscalPeriodStatus, CompanyTier, AccountType, EntryDirection, TaxCode } from './enums';

// User schemas
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(100),
  companyName: z.string().min(1).max(200),
});

// Company schemas
export const createCompanySchema = z.object({
  name: z.string().min(1).max(200),
  tier: z.nativeEnum(CompanyTier).default(CompanyTier.BRONZE),
  kraPin: z.string().length(11).optional(),
  parentCompanyId: z.string().uuid().optional(),
});

export const updateCompanySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  kraPin: z.string().length(11).optional(),
});

// Company member schemas
export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(CompanyRole),
});

// Chart of Account schemas
export const createAccountSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  type: z.nativeEnum(AccountType),
  parentId: z.string().uuid().optional(),
});

// Transaction schemas
export const incomeSchema = z.object({
  accountId: z.string().uuid(),
  description: z.string().min(1).max(500),
  amount: z.number().positive(),
  reference: z.string().max(100).optional(),
  entryDate: z.string().datetime(),
});

export const expenseSchema = z.object({
  accountId: z.string().uuid(),
  description: z.string().min(1).max(500),
  amount: z.number().positive(),
  reference: z.string().max(100).optional(),
  entryDate: z.string().datetime(),
  receiptImage: z.string().optional(),
});

export const journalEntrySchema = z.object({
  accountId: z.string().uuid(),
  description: z.string().min(1).max(500),
  amount: z.number().positive(),
  direction: z.nativeEnum(EntryDirection),
  reference: z.string().max(100).optional(),
  serialNumber: z.string().max(50).optional(),
  entryDate: z.string().datetime(),
});

// Fiscal period schemas
export const createFiscalPeriodSchema = z.object({
  name: z.string().min(1).max(100),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  status: z.nativeEnum(FiscalPeriodStatus).default(FiscalPeriodStatus.OPEN),
});

// Invoice schemas
export const createInvoiceSchema = z.object({
  customerName: z.string().min(1).max(200),
  customerPin: z.string().length(11).regex(/^[A-Z0-9]{11}$/, 'KRA PIN must be 11 uppercase alphanumeric characters').optional(),
  customerEmail: z.string().email().optional(),
  lineItems: z.array(z.object({
    description: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
  })).min(1),
  taxCode: z.nativeEnum(TaxCode).default(TaxCode.S),
  dueDate: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

// M-Pesa schemas
export const mpesaUploadSchema = z.object({
  csvData: z.string().min(1),
  fileName: z.string().min(1),
});

// HITL schemas
export const resolveReviewSchema = z.object({
  reviewId: z.string().uuid(),
  resolution: z.string().min(1).max(2000),
  action: z.enum(['APPROVE', 'REJECT', 'EDIT']),
  correctedData: z.string().optional(),
});

// Report schemas
export const reportQuerySchema = z.object({
  companyId: z.string().uuid(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  asOf: z.string().datetime().optional(),
  format: z.enum(['json', 'csv', 'pdf']).default('json'),
});

// Gamification schemas
export const wizardStepSchema = z.object({
  step: z.string(),
});

// Export types derived from schemas
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type IncomeInput = z.infer<typeof incomeSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type JournalEntryInput = z.infer<typeof journalEntrySchema>;
export type CreateFiscalPeriodInput = z.infer<typeof createFiscalPeriodSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type MpesaUploadInput = z.infer<typeof mpesaUploadSchema>;
export type ResolveReviewInput = z.infer<typeof resolveReviewSchema>;
export type ReportQueryInput = z.infer<typeof reportQuerySchema>;
export type WizardStepInput = z.infer<typeof wizardStepSchema>;
