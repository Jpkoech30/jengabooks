// ─── API Response Types ─────────────────────────────────────────────────

export interface Account {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  isActive: boolean;
  parentId?: string | null;
  parent?: Account | null;
  children?: Account[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface JournalEntry {
  id: string;
  companyId: string;
  accountId: string;
  account: { id: string; code: string; name: string; type: string };
  description: string;
  amount: number;
  direction: 'DEBIT' | 'CREDIT';
  reference?: string | null;
  serialNumber?: string | null;
  entryDate: string;
  version: number;
  postedById: string;
  postedBy?: { id: string; name: string };
  isReconciled: boolean;
  aiConfidence?: number | null;
  aiReasoning?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerPin?: string | null;
  customerEmail?: string | null;
  lineItems: string; // JSON string
  subtotal: number;
  vat: number;
  total: number;
  taxCode: string;
  status: string;
  dueDate?: string | null;
  paidAt?: string | null;
  notes?: string | null;
  createdAt: string;
  etimsSubmission?: {
    id: string;
    status: string;
    serialNumber: string;
    submittedAt?: string | null;
  } | null;
}

export interface MpesaTransaction {
  id: string;
  receiptNo?: string | null;
  transactionDate: string;
  description: string;
  amount: number;
  phoneNumber?: string | null;
  paybill?: string | null;
  isReconciled: boolean;
  mappedAccount?: { id: string; code: string; name: string } | null;
  category?: string | null;
}

export interface HitlTask {
  id: string;
  category: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED';
  assignedTo?: string | null;
  assignedUser?: { id: string; name: string } | null;
  resolvedBy?: string | null;
  resolvedUser?: { id: string; name: string } | null;
  resolvedAt?: string | null;
  xpAwarded: number;
  createdAt: string;
}

export interface TrialBalance {
  accounts: Array<{ code: string; name: string; type: string; debit: number; credit: number }>;
  totalDebits: number;
  totalCredits: number;
  balanced: boolean;
  asOf: string;
}

export interface ProfitLoss {
  period: { from: string; to: string };
  income: Array<{ code: string; name: string; amount: number }>;
  expenses: Array<{ code: string; name: string; amount: number }>;
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
}

export interface BalanceSheet {
  asOf: string;
  assets: Array<{ code: string; name: string; balance: number }>;
  liabilities: Array<{ code: string; name: string; balance: number }>;
  equity: Array<{ code: string; name: string; balance: number }>;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  balanced: boolean;
}

export interface GamificationProfile {
  score: number;
  level: number;
  levelTitle: string;
  xpToNextLevel: number;
  badges: {
    earned: Array<{ id: string; name: string; icon: string; earnedAt: string }>;
    available: Array<{ id: string; name: string; description: string; icon: string; earned: boolean }>;
  };
  recentActivity: Array<{ points: number; reason: string; badge?: string | null; date: string }>;
}

export interface HealthScore {
  overallScore: number;
  pillars: Array<{
    name: string;
    weight: number;
    score: number;
    maxScore: number;
    details: string;
  }>;
  calculatedAt: string;
}

export interface WizardProgress {
  steps: Array<{
    step: string;
    label: string;
    xpReward: number;
    badgeAward: string | null;
    completed: boolean;
    completedAt: string | null;
  }>;
  totalSteps: number;
  completedSteps: number;
  percentage: number;
  totalXpEarned: number;
  badgesEarned: string[];
  nextStep: { step: string; label: string; xpReward: number } | null;
  isComplete: boolean;
}

export interface CompanyMember {
  id: string;
  userId: string;
  role: string;
  isActive: boolean;
  user: { id: string; email: string; name: string };
}

export interface AuthProfile {
  id: string;
  email: string;
  name: string;
  memberships: Array<{ companyId: string; companyName: string; role: string }>;
}
