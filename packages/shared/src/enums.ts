// Company roles
export const CompanyRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  FIRM_OWNER: 'FIRM_OWNER',
  TENANT_ADMIN: 'TENANT_ADMIN',
  ACCOUNTANT: 'ACCOUNTANT',
  SME_OWNER: 'SME_OWNER',
  AUDITOR: 'AUDITOR',
  BANK_OFFICER: 'BANK_OFFICER',
} as const;

export type CompanyRole = (typeof CompanyRole)[keyof typeof CompanyRole];

// Company tiers
export const CompanyTier = {
  BRONZE: 'BRONZE',
  GOLD: 'GOLD',
  PLATINUM: 'PLATINUM',
} as const;

export type CompanyTier = (typeof CompanyTier)[keyof typeof CompanyTier];

// Fiscal period statuses
export const FiscalPeriodStatus = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  LOCKED: 'LOCKED',
} as const;

export type FiscalPeriodStatus = (typeof FiscalPeriodStatus)[keyof typeof FiscalPeriodStatus];

// Invoice statuses
export const InvoiceStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
} as const;

export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

// eTIMS submission statuses
export const ETIMSStatus = {
  PENDING: 'PENDING',
  SUBMITTED: 'SUBMITTED',
  ACCEPTED: 'ACCEPTED',
  FAILED: 'FAILED',
} as const;

export type ETIMSStatus = (typeof ETIMSStatus)[keyof typeof ETIMSStatus];

// Tax codes (Kenya)
export const TaxCode = {
  E: 'E', // Exempt
  S: 'S', // Standard (16% VAT)
  Z: 'Z', // Zero-rated
} as const;

export type TaxCode = (typeof TaxCode)[keyof typeof TaxCode];

// HITL review statuses
export const HITLStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
} as const;

export type HITLStatus = (typeof HITLStatus)[keyof typeof HITLStatus];

// HITL review categories
export const HITLCategory = {
  BACKDATED_ENTRY: 'BACKDATED_ENTRY',
  UNMAPPED_DATA: 'UNMAPPED_DATA',
  ETIMS_FAILURE: 'ETIMS_FAILURE',
  RECONCILIATION_CONFLICT: 'RECONCILIATION_CONFLICT',
} as const;

export type HITLCategory = (typeof HITLCategory)[keyof typeof HITLCategory];

// Sync statuses
export const SyncStatus = {
  PENDING: 'PENDING',
  SYNCED: 'SYNCED',
  CONFLICT: 'CONFLICT',
} as const;

export type SyncStatus = (typeof SyncStatus)[keyof typeof SyncStatus];

// AI agent types
export const AgentType = {
  RECONCILIATION: 'RECONCILIATION',
  COMPLIANCE: 'COMPLIANCE',
  FRAUD: 'FRAUD',
  ADVISORY: 'ADVISORY',
} as const;

export type AgentType = (typeof AgentType)[keyof typeof AgentType];

// Account types (Chart of Accounts)
export const AccountType = {
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
} as const;

export type AccountType = (typeof AccountType)[keyof typeof AccountType];

// Journal entry direction
export const EntryDirection = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
} as const;

export type EntryDirection = (typeof EntryDirection)[keyof typeof EntryDirection];

// Wizard steps for gamified onboarding
export const WizardStep = {
  COMPANY_PROFILE: 'COMPANY_PROFILE',
  CHART_OF_ACCOUNTS: 'CHART_OF_ACCOUNTS',
  CONNECT_MPESA: 'CONNECT_MPESA',
  IMPORT_MPESA: 'IMPORT_MPESA',
  FIRST_INCOME: 'FIRST_INCOME',
  FIRST_EXPENSE: 'FIRST_EXPENSE',
  FIRST_INVOICE: 'FIRST_INVOICE',
  FIRST_ETIMS: 'FIRST_ETIMS',
  INVITE_TEAM: 'INVITE_TEAM',
  FIRST_REPORT: 'FIRST_REPORT',
} as const;

export type WizardStep = (typeof WizardStep)[keyof typeof WizardStep];

// Badge definitions
export const Badge = {
  ACCOUNTANT: 'Accountant',
  MPESA_CONNECTED: 'M-Pesa Connected',
  DATA_DRIVEN: 'Data Driven',
  FIRST_INCOME: 'First Income',
  FIRST_EXPENSE: 'First Expense',
  INVOICER: 'Invoicer',
  TAX_COMPLIANT: 'Tax Compliant',
  TEAM_PLAYER: 'Team Player',
  ANALYST: 'Analyst',
} as const;

export type Badge = (typeof Badge)[keyof typeof Badge];

// Statement upload statuses
export const StatementUploadStatus = {
  PENDING_PARSING: 'PENDING_PARSING',
  PARSING: 'PARSING',
  PARSED: 'PARSED',
  RECONCILED: 'RECONCILED',
  FAILED: 'FAILED',
} as const;

export type StatementUploadStatus = (typeof StatementUploadStatus)[keyof typeof StatementUploadStatus];

// Financial institutions supported for statement uploads
export const Institution = {
  MPESA: 'MPESA',
  KCB: 'KCB',
  EQUITY: 'EQUITY',
  COOP: 'COOP',
  SCB: 'SCB',
  OTHER: 'OTHER',
} as const;

export type Institution = (typeof Institution)[keyof typeof Institution];

// Detection methods
export const DetectionMethod = {
  AUTO: 'AUTO',
  USER_SELECTED: 'USER_SELECTED',
} as const;

export type DetectionMethod = (typeof DetectionMethod)[keyof typeof DetectionMethod];

// XP amounts for wizard steps
export const WizardXpReward: Record<string, number> = {
  [WizardStep.COMPANY_PROFILE]: 50,
  [WizardStep.CHART_OF_ACCOUNTS]: 50,
  [WizardStep.CONNECT_MPESA]: 100,
  [WizardStep.IMPORT_MPESA]: 100,
  [WizardStep.FIRST_INCOME]: 100,
  [WizardStep.FIRST_EXPENSE]: 100,
  [WizardStep.FIRST_INVOICE]: 150,
  [WizardStep.FIRST_ETIMS]: 200,
  [WizardStep.INVITE_TEAM]: 50,
  [WizardStep.FIRST_REPORT]: 100,
};

// Badge awards per wizard step
export const WizardBadgeAward: Record<string, string | null> = {
  [WizardStep.COMPANY_PROFILE]: null,
  [WizardStep.CHART_OF_ACCOUNTS]: Badge.ACCOUNTANT,
  [WizardStep.CONNECT_MPESA]: Badge.MPESA_CONNECTED,
  [WizardStep.IMPORT_MPESA]: Badge.DATA_DRIVEN,
  [WizardStep.FIRST_INCOME]: Badge.FIRST_INCOME,
  [WizardStep.FIRST_EXPENSE]: Badge.FIRST_EXPENSE,
  [WizardStep.FIRST_INVOICE]: Badge.INVOICER,
  [WizardStep.FIRST_ETIMS]: Badge.TAX_COMPLIANT,
  [WizardStep.INVITE_TEAM]: Badge.TEAM_PLAYER,
  [WizardStep.FIRST_REPORT]: Badge.ANALYST,
};

// Level thresholds
export const LEVEL_THRESHOLDS = [
  { level: 1, minXp: 0, title: 'Apprentice' },
  { level: 2, minXp: 100, title: 'Apprentice' },
  { level: 3, minXp: 300, title: 'Apprentice' },
  { level: 4, minXp: 600, title: 'Apprentice' },
  { level: 5, minXp: 1000, title: 'Apprentice' },
  { level: 6, minXp: 1500, title: 'Bookkeeper' },
  { level: 7, minXp: 2100, title: 'Bookkeeper' },
  { level: 8, minXp: 2800, title: 'Bookkeeper' },
  { level: 9, minXp: 3600, title: 'Bookkeeper' },
  { level: 10, minXp: 4500, title: 'Bookkeeper' },
  { level: 11, minXp: 5500, title: 'Accountant' },
  { level: 12, minXp: 6600, title: 'Accountant' },
  { level: 13, minXp: 7800, title: 'Accountant' },
  { level: 14, minXp: 9100, title: 'Accountant' },
  { level: 15, minXp: 10500, title: 'Accountant' },
  { level: 16, minXp: 12000, title: 'Accountant' },
  { level: 17, minXp: 13600, title: 'Accountant' },
  { level: 18, minXp: 15300, title: 'Accountant' },
  { level: 19, minXp: 17100, title: 'Accountant' },
  { level: 20, minXp: 19000, title: 'Accountant' },
  { level: 21, minXp: 21000, title: 'Finance Pro' },
  { level: 22, minXp: 23100, title: 'Finance Pro' },
  { level: 23, minXp: 25300, title: 'Finance Pro' },
  { level: 24, minXp: 27600, title: 'Finance Pro' },
  { level: 25, minXp: 30000, title: 'Finance Pro' },
  { level: 26, minXp: 32500, title: 'Finance Pro' },
  { level: 27, minXp: 35100, title: 'Finance Pro' },
  { level: 28, minXp: 37800, title: 'Finance Pro' },
  { level: 29, minXp: 40600, title: 'Finance Pro' },
  { level: 30, minXp: 43500, title: 'Finance Pro' },
  { level: 31, minXp: 46500, title: 'Business Master' },
  { level: 32, minXp: 49600, title: 'Business Master' },
  { level: 33, minXp: 52800, title: 'Business Master' },
  { level: 34, minXp: 56100, title: 'Business Master' },
  { level: 35, minXp: 59500, title: 'Business Master' },
  { level: 36, minXp: 63000, title: 'Business Master' },
  { level: 37, minXp: 66600, title: 'Business Master' },
  { level: 38, minXp: 70300, title: 'Business Master' },
  { level: 39, minXp: 74100, title: 'Business Master' },
  { level: 40, minXp: 78000, title: 'Business Master' },
  { level: 41, minXp: 82000, title: 'Business Master' },
  { level: 42, minXp: 86100, title: 'Business Master' },
  { level: 43, minXp: 90300, title: 'Business Master' },
  { level: 44, minXp: 94600, title: 'Business Master' },
  { level: 45, minXp: 99000, title: 'Business Master' },
  { level: 46, minXp: 103500, title: 'Business Master' },
  { level: 47, minXp: 108100, title: 'Business Master' },
  { level: 48, minXp: 112800, title: 'Business Master' },
  { level: 49, minXp: 117600, title: 'Business Master' },
  { level: 50, minXp: 122500, title: 'Business Master' },
];
