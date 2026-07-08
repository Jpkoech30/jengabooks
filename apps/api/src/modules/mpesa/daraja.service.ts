import { Injectable, Logger, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import * as crypto from 'crypto';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface DarajaOAuthResponse {
  access_token: string;
  expires_in: number; // seconds, typically 3600
}

export interface DarajaTransactionStatusRequest {
  Initiator: string;
  SecurityCredential: string;
  CommandID: 'TransactionStatusQuery';
  PartyA: string;
  IdentifierType: '4';
  Remarks: string;
  QueueTimeOutURL: string;
  ResultURL: string;
  TransactionID: string;
}

export interface DarajaTransactionStatusResponse {
  ResponseCode: string;
  ResponseDescription: string;
  OriginatorConversationID: string;
  ConversationID: string;
  Result?: {
    ResultType: number;
    ResultCode: number;
    ResultDesc: string;
    TransactionID: string;
    ResultParameters?: {
      ResultParameter: Array<{
        Key: string;
        Value: string;
      }>;
    };
  };
}

export interface C2BWebhookPayload {
  TransactionType: string;
  TransID: string;
  TransTime: string; // YYYYMMDDHHmmss
  TransAmount: string;
  BusinessShortCode: string;
  BillRefNumber: string;
  InvoiceNumber?: string;
  OrgAccountBalance?: string;
  ThirdPartyTransID?: string;
  MSISDN: string;
  FirstName: string;
  MiddleName?: string;
  LastName?: string;
}

export interface TransactionStatusWebhookPayload {
  Result: {
    ResultType: number;
    ResultCode: number;
    ResultDesc: string;
    TransactionID: string;
    OriginatorConversationID: string;
    ConversationID: string;
    ResultParameters?: {
      ResultParameter: Array<{
        Key: string;
        Value: string;
      }>;
    };
  };
}

// ─── Constants ─────────────────────────────────────────────────────────────

const DARAJA_API_BASE_URLS: Record<string, string> = {
  sandbox: 'https://sandbox.safaricom.co.ke',
  production: 'https://api.safaricom.co.ke',
};

const TOKEN_CACHE_TTL_SEC = 3300; // 55 minutes (tokens expire in 1 hour)
const REQUEST_TIMEOUT_MS = 15_000;

// ─── Service ───────────────────────────────────────────────────────────────

@Injectable()
export class DarajaService {
  private readonly logger = new Logger(DarajaService.name);

  private readonly apiBaseUrl: string;
  private readonly consumerKey: string;
  private readonly consumerSecret: string;
  private readonly passkey: string;
  private readonly shortcode: string;
  private readonly environment: string;
  private readonly callbackBaseUrl: string;

  // In-memory token cache (singleton per process — sufficient for single-instance)
  private memoryToken: { token: string; expiresAt: number } | null = null;

  constructor(
    private readonly httpService: HttpService,
  ) {
    this.environment = process.env.MPESA_ENVIRONMENT || 'sandbox';
    this.apiBaseUrl = DARAJA_API_BASE_URLS[this.environment] || DARAJA_API_BASE_URLS.sandbox;
    this.consumerKey = process.env.MPESA_CONSUMER_KEY || '';
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET || '';
    this.passkey = process.env.MPESA_PASSKEY || '';
    this.shortcode = process.env.MPESA_SHORTCODE || '';
    this.callbackBaseUrl = process.env.CALLBACK_BASE_URL || 'http://localhost:3001';

    if (!this.consumerKey || !this.consumerSecret) {
      this.logger.warn('M-Pesa Daraja API credentials not configured. DarajaService will be inactive.');
    }
  }

  get isConfigured(): boolean {
    return !!(this.consumerKey && this.consumerSecret && this.shortcode);
  }

  // ─── OAuth2: Token Management ──────────────────────────────────────────

  /**
   * Gets a valid access token, using in-memory cached version if available.
   */
  async getAccessToken(): Promise<string> {
    // Try in-memory cache
    if (this.memoryToken && this.memoryToken.expiresAt > Date.now() + 60_000) {
      this.logger.debug('Using cached Daraja access token from memory');
      return this.memoryToken.token;
    }

    // Fetch new token
    return this.fetchNewToken();
  }

  /**
   * Fetches a new access token from Daraja OAuth2 endpoint and caches it in-memory.
   */
  private async fetchNewToken(): Promise<string> {
    const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');

    const url = `${this.apiBaseUrl}/oauth/v1/generate?grant_type=client_credentials`;

    this.logger.log('Fetching new Daraja access token');

    const response = await lastValueFrom(
      this.httpService.post<DarajaOAuthResponse>(
        url,
        {},
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          timeout: REQUEST_TIMEOUT_MS,
        },
      ),
    );

    const data = response.data;
    const { access_token, expires_in } = data;

    if (!access_token) {
      throw new Error('Daraja OAuth2 response missing access_token');
    }

    // Cache in-memory
    this.memoryToken = {
      token: access_token,
      expiresAt: Date.now() + (expires_in || 3600) * 1000,
    };

    return access_token;
  }

  /**
   * Refreshes the token (invalidates in-memory cache, fetches new one).
   * Called when a 401 is received.
   */
  async refreshToken(): Promise<string> {
    this.logger.log('Refreshing expired Daraja access token');
    this.memoryToken = null;
    return this.fetchNewToken();
  }

  // ─── Security Credential ───────────────────────────────────────────────

  /**
   * Generates the SecurityCredential for transaction status queries.
   * Format: Base64(Shortcode + Passkey + Timestamp)
   * Timestamp format: YYYYMMDDHHmmss
   * Uses a provided timestamp (from Daraja or generated) — NOT Date.now() for financial logic.
   */
  generateSecurityCredential(timestamp: string): string {
    const password = `${this.shortcode}${this.passkey}${timestamp}`;
    return Buffer.from(password).toString('base64');
  }

  /**
   * Generates a timestamp in Daraja format YYYYMMDDHHmmss.
   * This is a communication protocol timestamp (not a financial record timestamp),
   * so Date() is acceptable per TIME-TRAVEL rules (display/communication only).
   */
  generateTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  // ─── Transaction Status Query ──────────────────────────────────────────

  /**
   * Queries the status of a specific M-Pesa transaction.
   * Includes retry logic: on 401, refreshes token and retries once.
   */
  async queryTransactionStatus(transactionId: string): Promise<DarajaTransactionStatusResponse> {
    if (!this.isConfigured) {
      throw new Error('Daraja API is not configured. Set MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE.');
    }

    const token = await this.getAccessToken();
    const timestamp = this.generateTimestamp();
    const securityCredential = this.generateSecurityCredential(timestamp);

    const requestBody: DarajaTransactionStatusRequest = {
      Initiator: 'JengaBooks',
      SecurityCredential: securityCredential,
      CommandID: 'TransactionStatusQuery',
      PartyA: this.shortcode,
      IdentifierType: '4',
      Remarks: 'JengaBooks sync',
      QueueTimeOutURL: `${this.callbackBaseUrl}/api/v1/mpesa/webhook/transaction-status`,
      ResultURL: `${this.callbackBaseUrl}/api/v1/mpesa/webhook/transaction-status`,
      TransactionID: transactionId,
    };

    return this.postWithRetry<DarajaTransactionStatusResponse>(
      '/mpesa/transactionstatus/v1/query',
      requestBody,
      token,
    );
  }

  // ─── HTTP Client with Retry ────────────────────────────────────────────

  /**
   * Makes an authenticated POST request to Daraja API via HttpService.
   * On 401, refreshes the token and retries once.
   */
  private async postWithRetry<T>(
    path: string,
    body: any,
    token: string,
    retried = false,
  ): Promise<T> {
    const url = `${this.apiBaseUrl}${path}`;

    try {
      const response = await lastValueFrom(
        this.httpService.post<T>(url, body, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: REQUEST_TIMEOUT_MS,
        }),
      );

      return response.data;
    } catch (err: any) {
      // Handle 401 (token expired) — refresh and retry once
      if (err.response?.status === 401 && !retried) {
        this.logger.warn('Daraja API returned 401 — refreshing token and retrying');
        const newToken = await this.refreshToken();
        return this.postWithRetry<T>(path, body, newToken, true);
      }

      // Handle network timeouts
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        this.logger.error(`Daraja API timeout for ${path}`);
        throw new Error(`Daraja API timeout: ${path}`);
      }

      throw err;
    }
  }

  // ─── Webhook Signature Validation ──────────────────────────────────────

  /**
   * Validates an incoming webhook from Safaricom.
   * In production, verifies the HMAC-SHA-256 signature sent by Safaricom.
   * The webhook payload includes an optional `Signature` field or a
   * `X-Safaricom-Signature` header containing the HMAC.
   *
   * Signature is HMAC-SHA-256 over concatenation of:
   * TransID + TransTime + TransAmount + BillRefNumber + MSISDN
   */
  validateWebhookSignature(
    payload: C2BWebhookPayload,
    signatureHeader?: string,
  ): boolean {
    // If no passkey configured, skip validation in sandbox/dev
    const currentEnv = process.env.MPESA_ENVIRONMENT || this.environment;
    if (currentEnv === 'sandbox' || !this.passkey) {
      this.logger.debug('Skipping webhook signature validation in sandbox mode');
      return true;
    }

    // Production: validate HMAC-SHA-256 signature
    // Safaricom sends signature in X-Safaricom-Signature header
    const signature = signatureHeader || (payload as any).Signature;

    if (!signature) {
      this.logger.warn('Webhook missing signature — rejecting');
      return false;
    }

    try {
      // Build the data string to verify
      const dataToSign = [
        payload.TransID || '',
        payload.TransTime || '',
        payload.TransAmount || '',
        payload.BillRefNumber || '',
        payload.MSISDN || '',
      ].join('');

      const expectedSignature = crypto
        .createHmac('sha256', this.passkey)
        .update(dataToSign)
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature.toLowerCase()),
        Buffer.from(expectedSignature.toLowerCase()),
      );

      if (!isValid) {
        this.logger.warn(`Webhook signature mismatch for TransID: ${payload.TransID}`);
      }

      return isValid;
    } catch (err: any) {
      this.logger.error(`Webhook signature validation error: ${err.message}`);
      return false;
    }
  }

  /**
   * Validates a C2B validation request from Safaricom.
   * Safaricom sends a validation request before processing the transaction.
   * We always respond positively to accept the transaction.
   */
  validateC2BRequest(payload: any): { ResultCode: number; ResultDesc: string } {
    return {
      ResultCode: 0,
      ResultDesc: 'Accepted',
    };
  }

  // ─── Utilities ─────────────────────────────────────────────────────────

  /**
   * Parses the Daraja TransTime format (YYYYMMDDHHmmss) to a Date object.
   * This converts a webhook-provided timestamp (TIME-TRAVEL compliant:
   * using data-provided timestamp, not client-side Date.now()).
   */
  parseTransTime(transTime: string): Date {
    const year = parseInt(transTime.substring(0, 4), 10);
    const month = parseInt(transTime.substring(4, 6), 10) - 1; // 0-based
    const day = parseInt(transTime.substring(6, 8), 10);
    const hours = parseInt(transTime.substring(8, 10), 10);
    const minutes = parseInt(transTime.substring(10, 12), 10);
    const seconds = parseInt(transTime.substring(12, 14), 10);
    return new Date(year, month, day, hours, minutes, seconds);
  }
}
