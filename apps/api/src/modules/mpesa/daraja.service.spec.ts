import { Test, TestingModule } from '@nestjs/testing';
import { DarajaService, C2BWebhookPayload } from './daraja.service';

describe('DarajaService', () => {
  let service: DarajaService;

  beforeAll(() => {
    // Set env vars for testing
    process.env.MPESA_CONSUMER_KEY = 'test-consumer-key';
    process.env.MPESA_CONSUMER_SECRET = 'test-consumer-secret';
    process.env.MPESA_PASSKEY = 'test-passkey-123';
    process.env.MPESA_SHORTCODE = '174379';
    process.env.MPESA_ENVIRONMENT = 'sandbox';
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DarajaService],
    }).compile();

    service = module.get<DarajaService>(DarajaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('configuration', () => {
    it('should be configured when env vars are set', () => {
      expect(service.isConfigured).toBe(true);
    });

    it('should not be configured when credentials are missing', async () => {
      delete process.env.MPESA_CONSUMER_KEY;
      const module: TestingModule = await Test.createTestingModule({
        providers: [DarajaService],
      }).compile();
      const unconfigured = module.get<DarajaService>(DarajaService);
      expect(unconfigured.isConfigured).toBe(false);

      // Restore
      process.env.MPESA_CONSUMER_KEY = 'test-consumer-key';
    });
  });

  describe('generateSecurityCredential', () => {
    it('should generate base64 encoded credential from shortcode + passkey + timestamp', () => {
      const timestamp = '20260708220000';
      const credential = service.generateSecurityCredential(timestamp);

      // Verify it's valid base64
      const decoded = Buffer.from(credential, 'base64').toString('utf-8');
      expect(decoded).toBe('174379test-passkey-12320260708220000');
    });

    it('should produce different credentials for different timestamps', () => {
      const cred1 = service.generateSecurityCredential('20260708220000');
      const cred2 = service.generateSecurityCredential('20260708230000');
      expect(cred1).not.toBe(cred2);
    });
  });

  describe('generateTimestamp', () => {
    it('should return a 14-character string in YYYYMMDDHHmmss format', () => {
      const timestamp = service.generateTimestamp();
      expect(timestamp).toMatch(/^\d{14}$/);
    });

    it('should start with current year', () => {
      const timestamp = service.generateTimestamp();
      const currentYear = new Date().getFullYear().toString();
      expect(timestamp.startsWith(currentYear)).toBe(true);
    });
  });

  describe('parseTransTime', () => {
    it('should parse Daraja TransTime format correctly', () => {
      const date = service.parseTransTime('20260708220000');
      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(6); // 0-based, so July = 6
      expect(date.getDate()).toBe(8);
      expect(date.getHours()).toBe(22);
      expect(date.getMinutes()).toBe(0);
      expect(date.getSeconds()).toBe(0);
    });

    it('should handle midnight correctly', () => {
      const date = service.parseTransTime('20260101000000');
      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(0); // January
      expect(date.getDate()).toBe(1);
      expect(date.getHours()).toBe(0);
      expect(date.getMinutes()).toBe(0);
    });
  });

  describe('validateWebhookSignature', () => {
    const validPayload: C2BWebhookPayload = {
      TransactionType: 'CustomerPayBillOnline',
      TransID: 'NFK9Q1K4C8',
      TransTime: '20260708220000',
      TransAmount: '1500.00',
      BusinessShortCode: '174379',
      BillRefNumber: 'INV-001',
      MSISDN: '254712345678',
      FirstName: 'John',
      LastName: 'Doe',
    };

    it('should skip validation in sandbox environment', () => {
      process.env.MPESA_ENVIRONMENT = 'sandbox';
      const result = service.validateWebhookSignature(validPayload);
      expect(result).toBe(true);
    });

    it('should validate signature in production mode when signature matches', async () => {
      process.env.MPESA_ENVIRONMENT = 'production';

      // Build what the expected signature would be
      const crypto = require('crypto');
      const dataToSign = [
        validPayload.TransID,
        validPayload.TransTime,
        validPayload.TransAmount,
        validPayload.BillRefNumber,
        validPayload.MSISDN,
      ].join('');

      const expectedSig = crypto
        .createHmac('sha256', 'test-passkey-123')
        .update(dataToSign)
        .digest('hex');

      const result = service.validateWebhookSignature(validPayload, expectedSig);
      expect(result).toBe(true);

      // Restore
      process.env.MPESA_ENVIRONMENT = 'sandbox';
    });

    it('should reject when signature does not match', async () => {
      process.env.MPESA_ENVIRONMENT = 'production';

      const result = service.validateWebhookSignature(validPayload, 'invalid-signature');
      expect(result).toBe(false);

      // Restore
      process.env.MPESA_ENVIRONMENT = 'sandbox';
    });

    it('should reject when no signature is provided in production', () => {
      process.env.MPESA_ENVIRONMENT = 'production';
      const result = service.validateWebhookSignature(validPayload, undefined);
      expect(result).toBe(false);
      process.env.MPESA_ENVIRONMENT = 'sandbox';
    });
  });

  describe('validateC2BRequest', () => {
    it('should always return ResultCode 0', () => {
      const result = service.validateC2BRequest({});
      expect(result.ResultCode).toBe(0);
      expect(result.ResultDesc).toBe('Accepted');
    });
  });

  describe('queryTransactionStatus', () => {
    it('should throw when API is not configured', async () => {
      delete process.env.MPESA_CONSUMER_KEY;
      const module: TestingModule = await Test.createTestingModule({
        providers: [DarajaService],
      }).compile();
      const svc = module.get<DarajaService>(DarajaService);

      await expect(svc.queryTransactionStatus('NFK9Q1K4C8'))
        .rejects.toThrow('Daraja API is not configured');

      process.env.MPESA_CONSUMER_KEY = 'test-consumer-key';
    });
  });
});
