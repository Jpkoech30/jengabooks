/**
 * Normalized transaction structure — the canonical output of every parser.
 * Front-end and classification engine expect exactly this shape.
 */
export interface NormalizedTransaction {
  date: string;               // ISO-8601 date string (YYYY-MM-DD)
  description: string;        // Clean, human-readable description
  moneyOut: number;           // Withdrawn amount (default 0)
  moneyIn: number;            // Deposited amount (default 0)
  balanceAfter: number;       // Running balance after transaction
  institution: string;        // "MPESA" or "KCB" etc.
  reference: string | null;   // Transaction ID, cheque no., receipt no.
  rawDescription: string;     // Original unprocessed text
  calculated: boolean;        // true if moneyOut/moneyIn were derived from balance difference
}

/**
 * Metadata extracted from a statement header.
 */
export interface StatementMetadata {
  accountNumber: string | null;
  periodStart: string | null;   // ISO date or null
  periodEnd: string | null;
  openingBalance: number | null;
}

/**
 * Every statement parser must implement this interface.
 * To add a new bank, create a class implementing these three methods
 * and register it in the ParserRegistry.
 */
export interface StatementParser {
  /** Unique institution identifier (e.g., "MPESA", "KCB") */
  institution: string;

  /**
   * Return true if the raw text of this file is meant for this parser.
   * Uses bank-specific regex patterns to detect the institution.
   */
  detect(rawText: string): boolean;

  /**
   * Extract header metadata: account number, statement period, opening balance.
   */
  extractMetadata(rawText: string): StatementMetadata;

  /**
   * Parse all transactions into the canonical NormalizedTransaction array.
   */
  parse(rawText: string): NormalizedTransaction[];
}
