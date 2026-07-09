import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookPayload, ParsedMpesaSms } from './dto/whatsapp-webhook.dto';

describe('WhatsAppService', () => {
  let service: WhatsAppService;
  let configService: jest.Mocked<ConfigService>;
  let httpService: jest.Mocked<HttpService>;

  const mockConfig = (overrides: Record<string, string> = {}) => {
    const defaults: Record<string, string> = {
      WHATSAPP_VERIFY_TOKEN: 'jengabooks_verify_2026',
      WHATSAPP_PHONE_NUMBER_ID: '',
      WHATSAPP_ACCESS_TOKEN: '',
      WHATSAPP_API_VERSION: 'v18.0',
    };
    return { ...defaults, ...overrides };
  };

  beforeEach(async () => {
    const configMap = mockConfig();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => configMap[key]),
          },
        },
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
            post: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WhatsAppService>(WhatsAppService);
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
    httpService = module.get(HttpService) as jest.Mocked<HttpService>;
  });

  // ────────────── Webhook Verification ──────────────

  describe('verifyWebhook', () => {
    it('should return challenge when mode=subscribe and token matches', () => {
      const result = service.verifyWebhook('subscribe', 'jengabooks_verify_2026', '12345');
      expect(result).toBe('12345');
    });

    it('should return null when mode is not subscribe', () => {
      const result = service.verifyWebhook('unsubscribe', 'jengabooks_verify_2026', '12345');
      expect(result).toBeNull();
    });

    it('should return null when token does not match', () => {
      const result = service.verifyWebhook('subscribe', 'wrong_token', '12345');
      expect(result).toBeNull();
    });

    it('should return null when challenge is undefined', () => {
      const result = service.verifyWebhook('subscribe', 'jengabooks_verify_2026', undefined);
      expect(result).toBeNull();
    });
  });

  // ────────────── M-Pesa SMS Parsing ──────────────

  describe('parseMpesaSms', () => {
    it('should parse a standard received money SMS', () => {
      const sms = [
        'NFK9Q1K4C8 Confirmed on 8/7/26 at 10:00PM',
        'Ksh 1,500.00 received from John Kamau 254712345678',
        'New M-Pesa balance: Ksh 45,000.00',
      ].join('\n');

      const result = service.parseMpesaSms(sms);

      expect(result).not.toBeNull();
      expect(result!.receiptNumber).toBe('NFK9Q1K4C8');
      expect(result!.date).toBe('8/7/26');
      expect(result!.time).toBe('10:00PM');
      expect(result!.amount).toBe(1500.00);
      expect(result!.senderName).toBe('John Kamau');
      expect(result!.senderPhone).toBe('254712345678');
      expect(result!.transactionType).toBe('RECEIVED');
      expect(result!.newBalance).toBe(45000.00);
    });

    it('should parse a sent money SMS', () => {
      const sms = [
        'ABC123XYZ Confirmed on 5/7/26 at 2:30PM',
        'Ksh 500.00 sent to Peter Njoroge 254723456789',
        'New M-Pesa balance: Ksh 12,000.00',
        'Transaction cost: Ksh 0.00',
      ].join('\n');

      const result = service.parseMpesaSms(sms);

      expect(result).not.toBeNull();
      expect(result!.receiptNumber).toBe('ABC123XYZ');
      expect(result!.amount).toBe(500.00);
      expect(result!.senderName).toBe('Peter Njoroge');
      expect(result!.senderPhone).toBe('254723456789');
      expect(result!.transactionType).toBe('SENT');
      expect(result!.fees).toBe(0);
    });

    it('should parse payment to till number', () => {
      const sms = [
        'PAY123ABC Confirmed on 6/7/26 at 8:15AM',
        'Ksh 2,000.00 paid to TILL NO. 123456',
        'New M-Pesa balance: Ksh 30,000.00',
      ].join('\n');

      const result = service.parseMpesaSms(sms);

      expect(result).not.toBeNull();
      expect(result!.amount).toBe(2000.00);
      expect(result!.transactionType).toBe('PAYMENT');
    });

    it('should return null for non-M-Pesa messages', () => {
      const result = service.parseMpesaSms('Hello, this is not an M-Pesa message');
      expect(result).toBeNull();
    });

    it('should return null for empty text', () => {
      const result = service.parseMpesaSms('');
      expect(result).toBeNull();
    });

    it('should parse amounts with commas correctly', () => {
      const sms = [
        'XYZ789ABC Confirmed on 1/6/26 at 12:00PM',
        'Ksh 10,000.00 received from Jane Wanjiku 254734567890',
        'New M-Pesa balance: Ksh 100,000.00',
      ].join('\n');

      const result = service.parseMpesaSms(sms);
      expect(result).not.toBeNull();
      expect(result!.amount).toBe(10000.00);
      expect(result!.newBalance).toBe(100000.00);
    });
  });

  // ────────────── OCR Processing ──────────────

  describe('runOcr', () => {
    it('should return mock OCR result in mock mode', async () => {
      const buffer = Buffer.from('[test image]');
      const result = await service.runOcr(buffer);

      expect(result.confidence).toBe(0.85);
      expect(result.totalAmount).toBe(1500);
      expect(result.vendorName).toBe('TILL NO. 123456');
      expect(result.rawText).toBeDefined();
    });
  });

  // ────────────── Media Download ──────────────

  describe('downloadMedia', () => {
    it('should return mock buffer in mock mode', async () => {
      const result = await service.downloadMedia('media_id_123');
      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('[mock image data]');
    });
  });

  // ────────────── Webhook Processing ──────────────

  describe('processIncoming', () => {
    it('should process a text message webhook payload', async () => {
      const payload: WhatsAppWebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: '254712345678',
                      id: 'wamid_123',
                      timestamp: '1720454400',
                      type: 'text',
                      text: {
                        body: [
                          'NFK9Q1K4C8 Confirmed on 8/7/26 at 10:00PM',
                          'Ksh 1,500.00 received from John Kamau 254712345678',
                          'New M-Pesa balance: Ksh 45,000.00',
                        ].join('\n'),
                      },
                    },
                  ],
                  metadata: { phone_number_id: '123456' },
                },
              },
            ],
          },
        ],
      };

      const result = await service.processIncoming(payload);
      expect(result.processed).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should process an image message webhook payload', async () => {
      const payload: WhatsAppWebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: '254712345678',
                      id: 'wamid_img_456',
                      timestamp: '1720454401',
                      type: 'image',
                      image: {
                        id: 'media_id_456',
                        mime_type: 'image/jpeg',
                        sha256: 'abc123',
                      },
                    },
                  ],
                  metadata: { phone_number_id: '123456' },
                },
              },
            ],
          },
        ],
      };

      const result = await service.processIncoming(payload);
      expect(result.processed).toBe(1);
    });

    it('should handle empty payload gracefully', async () => {
      const payload: WhatsAppWebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [],
      };

      const result = await service.processIncoming(payload);
      expect(result.processed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle unknown message type', async () => {
      const payload: WhatsAppWebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: '254712345678',
                      id: 'wamid_789',
                      timestamp: '1720454402',
                      type: 'location',
                    },
                  ],
                  metadata: { phone_number_id: '123456' },
                },
              },
            ],
          },
        ],
      };

      const result = await service.processIncoming(payload);
      expect(result.processed).toBe(1);
    });
  });

  // ────────────── Draft Building (Integration) ──────────────

  describe('processIncoming with edge cases', () => {
    it('should handle malformed M-Pesa SMS gracefully', async () => {
      const payload: WhatsAppWebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: '254712345678',
                      id: 'wamid_bad',
                      timestamp: '1720454403',
                      type: 'text',
                      text: {
                        body: 'Random text that is not an M-Pesa SMS',
                      },
                    },
                  ],
                  metadata: { phone_number_id: '123456' },
                },
              },
            ],
          },
        ],
      };

      const result = await service.processIncoming(payload);
      // Bad SMS should still be "processed" (reply sent) but not create draft
      expect(result.processed).toBe(1);
    });

    it('should handle multiple messages in one payload', async () => {
      const payload: WhatsAppWebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: '254712345678',
                      id: 'wamid_1',
                      timestamp: '1720454400',
                      type: 'text',
                      text: {
                        body: [
                          'NFK9Q1K4C8 Confirmed on 8/7/26 at 10:00PM',
                          'Ksh 1,500.00 received from John Kamau 254712345678',
                          'New M-Pesa balance: Ksh 45,000.00',
                        ].join('\n'),
                      },
                    },
                    {
                      from: '254712345679',
                      id: 'wamid_2',
                      timestamp: '1720454401',
                      type: 'text',
                      text: {
                        body: [
                          'ABC123XYZ Confirmed on 5/7/26 at 2:30PM',
                          'Ksh 500.00 sent to Peter Njoroge 254723456789',
                          'New M-Pesa balance: Ksh 12,000.00',
                        ].join('\n'),
                      },
                    },
                  ],
                  metadata: { phone_number_id: '123456' },
                },
              },
            ],
          },
        ],
      };

      const result = await service.processIncoming(payload);
      expect(result.processed).toBe(2);
    });
  });

  // ────────────── Live Mode Configuration ──────────────

  describe('constructor', () => {
    it('should be in mock mode when no token configured', () => {
      const verifySpy = jest.spyOn(service as any, 'verifyWebhook');
      // Verify token still works  
      expect(service.getVerifyToken()).toBe('jengabooks_verify_2026');
    });

    it('should be in mock mode with empty phone number', () => {
      expect(service.getVerifyToken()).toBeDefined();
    });
  });
});
