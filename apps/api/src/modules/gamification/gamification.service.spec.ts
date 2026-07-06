import { Test, TestingModule } from '@nestjs/testing';
import { GamificationService } from './gamification.service';

describe('GamificationService', () => {
  let service: GamificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationService,
        {
          provide: 'PrismaService',
          useValue: {
            xPRecord: { create: jest.fn(), aggregate: jest.fn(), findMany: jest.fn() },
            userLevel: { upsert: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
            chartOfAccount: { count: jest.fn() },
            mpesaTransaction: { count: jest.fn() },
            journalEntry: { count: jest.fn() },
            eTIMSSubmission: { count: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<GamificationService>(GamificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateLevel', () => {
    it('should return level 1 for 0 XP', () => {
      const result = GamificationService.calculateLevel(0);
      expect(result.level).toBe(1);
      expect(result.title).toBe('Apprentice');
    });

    it('should return level 5 for 1000 XP', () => {
      const result = GamificationService.calculateLevel(1000);
      expect(result.level).toBe(5);
      expect(result.title).toBe('Apprentice');
    });

    it('should return level 10 for 4500 XP', () => {
      const result = GamificationService.calculateLevel(4500);
      expect(result.level).toBe(10);
      expect(result.title).toBe('Bookkeeper');
    });

    it('should return level 50 for 122500 XP', () => {
      const result = GamificationService.calculateLevel(122500);
      expect(result.level).toBe(50);
      expect(result.title).toBe('Business Master');
    });

    it('should correctly report XP to next level', () => {
      const result = GamificationService.calculateLevel(100);
      expect(result.xpToNextLevel).toBe(200); // 300 - 100 = 200
    });
  });
});
