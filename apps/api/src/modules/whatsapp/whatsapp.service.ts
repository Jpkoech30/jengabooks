import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import {
  WhatsAppWebhookPayload,
  ParsedMpesaSms,
  OcrResult,
  DraftTransaction,
  WhatsAppReply,
  SendMessageResponse,
} from './dto/whatsapp-webhook.dto';

/**
 * WhatsApp Business API integration for receipt capture.
 *
 * Supports two modes:
 * 1. **Live mode**: Uses Meta's WhatsApp Cloud API when configured.
 * 2. **Mock mode**: Logs incoming data and returns mock responses when env vars are missing.
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly verifyToken: string;
  private readonly phoneNumberId: string;
  private readonly accessToken: string;
  private readonly apiVersion: string;
  private readonly isMockMode: boolean;
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.verifyToken = this.configService.get<string>('WHATSAPP_VERIFY_TOKEN') || '';
    this.phoneNumberId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID') || '';
    this.accessToken = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN') || '';
    this.apiVersion = this.configService.get<string>('WHATSAPP_API_VERSION') || 'v18.0';

    this.isMockMode = !this.accessToken || !this.phoneNumberId;
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;

    if (this.isMockMode) {
      this.logger.warn('WhatsApp API not configured — running in MOCK mode. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID for live mode.');
    } else {
      this.logger.log('WhatsApp API configured — running in LIVE mode.');
    }
  }

  /**
   * Verify the webhook subscription by returning the challenge token.
   * Meta sends a GET request with `hub.verify_token` and `hub.challenge`.
   */
  verifyWebhook(mode: string | undefined, token: string | undefined, challenge: string | undefined): string | null {
    if (!this.verifyToken) {
      this.logger.warn('WHATSAPP_VERIFY_TOKEN not configured — rejecting webhook verification');
      return null;
    }
    if (mode === 'subscribe' && token === this.verifyToken) {
      this.logger.log('Webhook verified successfully');
      return challenge || null;
    }
    this.logger.warn(`Webhook verification failed: mode=${mode}, token=${token}`);
    return null;
  }

  /**
   * Process an incoming WhatsApp message webhook payload.
   * Handles both image and text message types.
   */
  async processIncoming(payload: WhatsAppWebhookPayload): Promise<{ processed: number; errors: string[] }> {
    const errors: string[] = [];
    let processed = 0;

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const messages = change.value?.messages || [];

        for (const msg of messages) {
          try {
            await this.handleMessage(msg, change.value.metadata?.phone_number_id);
            processed++;
          } catch (err: any) {
            const errorMsg = `Failed to process message ${msg.id}: ${err.message}`;
            this.logger.error(errorMsg, err.stack);
            errors.push(errorMsg);
          }
        }
      }
    }

    return { processed, errors };
  }

  /**
   * Route a message to the appropriate handler based on type.
   */
  private async handleMessage(msg: any, phoneNumberId: string): Promise<void> {
    this.logger.debug(`Processing message ${msg.id} of type ${msg.type} from ${msg.from}`);

    let draft: DraftTransaction | null = null;

    if (msg.type === 'image' && msg.image) {
      draft = await this.processImageMessage(msg, phoneNumberId);
    } else if (msg.type === 'text' && msg.text) {
      draft = await this.processTextMessage(msg);
    } else {
      await this.sendReply(msg.from, {
        body: this.buildUnknownFormatReply(),
        preview_url: false,
      });
      return;
    }

    if (draft) {
      await this.sendConfirmation(msg.from, draft);
    } else {
      await this.sendReply(msg.from, {
        body: '❌ Could not process your message. Please upload a clearer image or forward the M-Pesa SMS directly.',
        preview_url: false,
      });
    }
  }

  /**
   * Process an image message: download media, run OCR, extract data.
   */
  private async processImageMessage(msg: any, phoneNumberId: string): Promise<DraftTransaction | null> {
    try {
      // Download the media from WhatsApp servers
      const mediaData = await this.downloadMedia(msg.image.id);

      // Run OCR on the downloaded image
      const ocrResult = await this.runOcr(mediaData);

      // Check for low confidence / blurry images
      if (ocrResult.confidence < 0.3) {
        // Retry with enhanced processing
        const enhancedResult = await this.runOcr(mediaData, { enhanced: true });
        if (enhancedResult.confidence < 0.3) {
          this.logger.warn(`Low OCR confidence for message ${msg.id}: ${enhancedResult.confidence}`);
          return null;
        }
        return this.buildDraftFromOcr(enhancedResult, msg.from);
      }

      // Check for handwritten receipts
      if (this.isHandwritten(ocrResult.rawText)) {
        await this.sendReply(msg.from, {
          body: '📝 *Manual Entry Required*\n\nThis appears to be a handwritten receipt. Please enter the transaction details manually in the JengaBooks app, or upload a clearer printed receipt.',
          preview_url: false,
        });
        return null;
      }

      return this.buildDraftFromOcr(ocrResult, msg.from);
    } catch (err: any) {
      this.logger.error(`Image processing failed for ${msg.id}: ${err.message}`);
      return null;
    }
  }

  /**
   * Process a text message: parse as M-Pesa SMS format.
   */
  private async processTextMessage(msg: any): Promise<DraftTransaction | null> {
    const parsed = this.parseMpesaSms(msg.text.body);
    if (!parsed) {
      this.logger.warn(`Failed to parse M-Pesa SMS from ${msg.from}`);
      return null;
    }

    return {
      amount: parsed.amount,
      description: `${parsed.transactionType === 'RECEIVED' ? 'Received from' : 'Sent to'} ${parsed.senderName}`,
      entryDate: `${parsed.date}T${parsed.time}`,
      reference: parsed.receiptNumber,
      source: 'WHATSAPP_MPESA',
      vendorName: parsed.senderName,
      phoneNumber: parsed.senderPhone,
    };
  }

  // ──────────────────────────────────────────────
  //  M-Pesa SMS Parser
  // ──────────────────────────────────────────────

  /**
   * Parse an M-Pesa SMS message and extract transaction details.
   *
   * Handles formats like:
   * ```
   * NFK9Q1K4C8 Confirmed on 8/7/26 at 10:00PM
   * Ksh 1,500.00 received from John Kamau 254712345678
   * New M-Pesa balance: Ksh 45,000.00
   * ```
   */
  parseMpesaSms(text: string): ParsedMpesaSms | null {
    const lines = text.trim().split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      return null;
    }

    try {
      // Line 1: Receipt number and date/time
      // Pattern: "NFK9Q1K4C8 Confirmed on 8/7/26 at 10:00PM"
      const firstLineMatch = lines[0].match(
        /^([A-Z0-9]+)\s+Confirmed\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+at\s+(\d{1,2}:\d{2}(?:AM|PM))/i,
      );
      if (!firstLineMatch) {
        return null;
      }

      const receiptNumber = firstLineMatch[1];
      const date = firstLineMatch[2];
      const time = firstLineMatch[3];

      // Line 2: Amount and sender/receiver
      // Pattern: "Ksh 1,500.00 received from John Kamau 254712345678"
      // Or: "Ksh 500.00 sent to Safaricom 123456"
      const secondLine = lines[1];
      const amountMatch = secondLine.match(/Ksh\s+([\d,]+\.\d{2})/i);
      if (!amountMatch) {
        return null;
      }

      const amount = parseFloat(amountMatch[1].replace(/,/g, ''));

      // Determine transaction type
      let transactionType: 'RECEIVED' | 'SENT' | 'PAYMENT';
      let senderName = '';
      let senderPhone = '';

      if (/received from/i.test(secondLine)) {
        transactionType = 'RECEIVED';
        const senderMatch = secondLine.match(/received from\s+(.+?)\s+(\d+)$/i);
        if (senderMatch) {
          senderName = senderMatch[1].trim();
          senderPhone = senderMatch[2].trim();
        }
      } else if (/sent to/i.test(secondLine)) {
        transactionType = 'SENT';
        const sentMatch = secondLine.match(/sent to\s+(.+?)\s+(\d+)$/i);
        if (sentMatch) {
          senderName = sentMatch[1].trim();
          senderPhone = sentMatch[2].trim();
        }
      } else if (/paid to/i.test(secondLine) || /payments?/i.test(secondLine)) {
        transactionType = 'PAYMENT';
        const payMatch = secondLine.match(/(?:paid to|payment to)\s+(.+?)(?:\s+\d+)?$/i);
        if (payMatch) {
          senderName = payMatch[1].trim();
        }
      } else {
        // Try to extract sender info from any pattern
        const namePhoneMatch = secondLine.match(/(?:from|to)\s+(.+?)\s+(\d{9,12})$/i);
        if (namePhoneMatch) {
          senderName = namePhoneMatch[1].trim();
          senderPhone = namePhoneMatch[2].trim();
        }
        transactionType = /from/i.test(secondLine) ? 'RECEIVED' : 'SENT';
      }

      // Line 3: Balance (optional) and fees
      let fees: number | undefined;
      let newBalance: number | undefined;

      for (const line of lines.slice(2)) {
        // Check for fees
        const feeMatch = line.match(/(?:fee|charge|transaction cost)[:\s]+Ksh\s+([\d,]+\.\d{2})/i);
        if (feeMatch) {
          fees = parseFloat(feeMatch[1].replace(/,/g, ''));
        }

        // Check for new balance
        const balanceMatch = line.match(/balance[:\s]+Ksh\s+([\d,]+\.\d{2})/i);
        if (balanceMatch) {
          newBalance = parseFloat(balanceMatch[1].replace(/,/g, ''));
        }
      }

      return {
        receiptNumber,
        date,
        time,
        amount,
        senderName: senderName || 'Unknown',
        senderPhone: senderPhone || '',
        transactionType,
        fees: fees || (transactionType === 'SENT' || transactionType === 'PAYMENT' ? 0 : undefined),
        newBalance,
      };
    } catch (err: any) {
      this.logger.error(`M-Pesa SMS parsing error: ${err.message}`);
      return null;
    }
  }

  // ──────────────────────────────────────────────
  //  OCR Integration
  // ──────────────────────────────────────────────

  /**
   * Run OCR on image buffer data.
   *
   * In production, this would use Tesseract.js. In mock mode, returns a placeholder result.
   * Retry logic: if confidence < 0.3 with normal processing, retry with enhanced settings.
   */
  async runOcr(imageBuffer: Buffer, options?: { enhanced?: boolean }): Promise<OcrResult> {
    if (this.isMockMode) {
      this.logger.debug('OCR mock: returning placeholder result');
      return {
        totalAmount: 1500,
        vendorName: 'TILL NO. 123456',
        date: '8/7/2026',
        lineItems: [{ description: 'Sale', amount: 1500 }],
        confidence: 0.85,
        rawText: 'TILL NO. 123456\nAmount: KES 1,500.00\nDate: 8/7/2026',
      };
    }

    try {
      // In production, use Tesseract.js for OCR
      // const { createWorker } = await import('tesseract.js');
      // const worker = await createWorker(options?.enhanced ? 'eng+swa' : 'eng');
      // const { data } = await worker.recognize(imageBuffer);
      // await worker.terminate();

      // Placeholder for actual Tesseract integration
      const rawText = '[OCR would process image bytes here]';

      return {
        confidence: 0,
        rawText,
        totalAmount: undefined,
        vendorName: undefined,
        date: undefined,
      };
    } catch (err: any) {
      this.logger.error(`OCR error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Detect if the OCR result appears to be handwritten.
   * Uses heuristics on the raw text.
   */
  private isHandwritten(rawText: string): boolean {
    // Handwriting typically has irregular spacing, lower confidence characters
    const handwritingIndicators = [
      /[™©®]/, // Special chars often misrecognized
      /\b[A-Z][a-z]+\s+[a-z]+\s+\d{4}\b/, // Irregular date patterns
    ];

    // If text is very short or has no clear structure, suspect handwriting
    if (rawText.length < 20) {
      return true;
    }

    // Check for typical printed receipt markers
    const printedIndicators = [
      /TILL\s+NO/i,
      /Receipt/i,
      /Invoice/i,
      /\d{4,}/, // Has numeric sequences
      /KES/i,
      /Total/i,
      /Sub.?Total/i,
      /Tax/i,
    ];

    const hasPrintedMarker = printedIndicators.some((p) => p.test(rawText));
    return !hasPrintedMarker;
  }

  // ──────────────────────────────────────────────
  //  Media Download
  // ──────────────────────────────────────────────

  /**
   * Download media from WhatsApp servers using the media ID.
   * Implements retry logic for transient failures.
   */
  async downloadMedia(mediaId: string): Promise<Buffer> {
    if (this.isMockMode) {
      this.logger.debug(`Mock download of media ${mediaId}`);
      return Buffer.from('[mock image data]');
    }

    const url = `${this.baseUrl}/${mediaId}`;
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await firstValueFrom(
          this.httpService.get(url, {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
            },
            responseType: 'arraybuffer',
          }),
        );
        return Buffer.from(response.data as ArrayBuffer);
      } catch (err: any) {
        lastError = err;
        this.logger.warn(`Media download attempt ${attempt}/${maxRetries} failed: ${err.message}`);
        if (attempt < maxRetries) {
          const delay = attempt * 1000;
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw lastError || new Error(`Failed to download media ${mediaId} after ${maxRetries} attempts`);
  }

  // ──────────────────────────────────────────────
  //  Draft Transaction Builder
  // ──────────────────────────────────────────────

  /**
   * Build a draft transaction from OCR results.
   */
  private buildDraftFromOcr(ocr: OcrResult, from: string): DraftTransaction | null {
    if (!ocr.totalAmount) {
      this.logger.warn(`OCR result missing total amount for message from ${from}`);
      return null;
    }

    return {
      amount: ocr.totalAmount,
      description: ocr.vendorName ? `Payment to ${ocr.vendorName}` : 'Receipt capture (WhatsApp)',
      entryDate: ocr.date ? this.normalizeDate(ocr.date) : new Date().toISOString(),
      source: 'WHATSAPP_IMAGE',
      vendorName: ocr.vendorName,
    };
  }

  /**
   * Normalize various date formats to ISO 8601.
   */
  private normalizeDate(dateStr: string): string {
    // Handle "8/7/26" or "8/7/2026" format (DD/MM/YY)
    const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (slashMatch) {
      const day = slashMatch[1].padStart(2, '0');
      const month = slashMatch[2].padStart(2, '0');
      let year = slashMatch[3];
      if (year.length === 2) {
        year = `20${year}`;
      }
      return `${year}-${month}-${day}T00:00:00.000Z`;
    }

    // Try ISO format
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00.000Z`;
    }

    // Fallback: return as-is
    return dateStr;
  }

  // ──────────────────────────────────────────────
  //  WhatsApp Message Sending
  // ──────────────────────────────────────────────

  /**
   * Send a confirmation reply to the user with extracted transaction details.
   */
  async sendConfirmation(to: string, draft: DraftTransaction): Promise<void> {
    const formattedAmount = this.formatCurrency(draft.amount);
    const formattedDate = this.formatDisplayDate(draft.entryDate);

    const body = [
      '✅ *Receipt Captured!*',
      '',
      `📄 Amount: ${formattedAmount}`,
      draft.vendorName ? `🏪 Vendor: ${draft.vendorName}` : null,
      `📅 Date: ${formattedDate}`,
      `📎 Transaction: ${draft.reference || 'Pending'}`,
      '',
      'You can view this transaction in the JengaBooks app.',
    ]
      .filter(Boolean)
      .join('\n');

    await this.sendReply(to, { body, preview_url: false });
  }

  /**
   * Send a text reply via WhatsApp Cloud API.
   */
  async sendReply(to: string, text: { body: string; preview_url: boolean }): Promise<void> {
    if (this.isMockMode) {
      this.logger.debug(`[MOCK] Reply to ${to}: ${text.body.substring(0, 100)}...`);
      return;
    }

    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

    const payload: WhatsAppReply = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post<SendMessageResponse>(url, payload, {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }),
      );
      this.logger.debug(`Reply sent to ${to}, message ID: ${response.data.messages?.[0]?.id}`);
    } catch (err: any) {
      this.logger.error(`Failed to send reply to ${to}: ${err.message}`);
      // Don't throw — replying is best-effort
    }
  }

  /**
   * Build a fallback reply for unrecognized message formats.
   */
  private buildUnknownFormatReply(): string {
    return [
      '❌ *Could not process your message*',
      '',
      'Please send one of the following:',
      '📷 A photo of your receipt',
      '📱 Forwarded M-Pesa SMS',
      '',
      'Supported formats: Till receipts, invoices, M-Pesa transactions.',
    ].join('\n');
  }

  // ──────────────────────────────────────────────
  //  Utility Methods
  // ──────────────────────────────────────────────

  private formatCurrency(amount: number): string {
    return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  private formatDisplayDate(isoDate: string): string {
    try {
      const d = new Date(isoDate);
      return d.toLocaleDateString('en-KE', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoDate;
    }
  }

  /**
   * Get the verify token (used by controller for webhook verification).
   */
  getVerifyToken(): string {
    return this.verifyToken;
  }
}
