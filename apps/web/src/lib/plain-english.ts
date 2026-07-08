/**
 * Plain English mapping — translates accounting jargon into plain language
 * for SME owners who don't understand accounting terms.
 *
 * Usage: `t(text, store.plainEnglish)` returns translated or original text.
 */

export const PLAIN_ENGLISH: Record<string, string> = {
  // Page titles
  'General Ledger': 'All Transactions',
  'Chart of Accounts': 'Categories & Codes',
  'Trial Balance': 'Account Balances',
  'Profit & Loss': 'Income & Expenses',
  'Balance Sheet': 'What You Own & Owe',
  'Cash Flow Statement': 'Money In & Out',

  // Labels
  'Accounts Receivable': 'Money Owed to You',
  'Accounts Payable': 'Money You Owe',
  'Depreciation': 'Asset Value Loss Over Time',
  'Cost of Goods Sold': 'Direct Product Costs',
  'Accrued Expenses': "Bills You Haven't Paid Yet",
  'Amortization': 'Loan Payment Over Time',
  'Debit': 'Increase',
  'Credit': 'Decrease',
  'Journal Entry': 'Transaction Record',
  'Post': 'Save',
  'Reconcile': 'Match & Verify',
  'Categorize': 'Sort',
  'Lock Period': 'Close for Changes',

  // KPI cards
  'Total Debits': 'Total Inflows',
  'Total Credits': 'Total Outflows',
  'Net Profit': 'Your Earnings',
  'Net Loss': 'Your Loss',
  'Total Income': 'Money Received',
  'Total Expenses': 'Money Spent',
  'Income': 'Money Received',

  // Dashboard
  'Month-End Progress': 'Bookkeeping Progress',
  'Recent Activity': 'Recent Changes',
  'Firm Dashboard': 'All Clients Overview',

  // Reports
  'Revenue': 'Sales Income',
  'Expenses': 'Costs',
  'Net Income': 'Profit',
  'Assets': 'What You Own',
  'Liabilities': 'What You Owe',
  'Equity': 'Your Share',
};

/**
 * Translate a text string if plain English mode is active.
 * Falls through to the original text if no mapping exists.
 */
export function t(text: string, usePlainEnglish: boolean): string {
  if (!usePlainEnglish) return text;
  return PLAIN_ENGLISH[text] || text;
}
