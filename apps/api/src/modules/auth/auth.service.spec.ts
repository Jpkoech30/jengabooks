import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    password: bcrypt.hashSync('password123', 10),
    name: 'Test User',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    memberships: [
      {
        companyId: 'company-1',
        company: { id: 'company-1', name: 'Test Company', tier: 'BRONZE' },
        role: 'SME_OWNER',
        isActive: true,
      },
    ],
  };

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    company: {
      create: jest.fn(),
    },
    companyMember: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    xPRecord: {
      create: jest.fn(),
      aggregate: jest.fn(),
    },
    userLevel: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        {
          provide: GamificationService,
          useValue: {
            awardXp: jest.fn().mockResolvedValue({}),
            calculateLevel: jest.fn().mockReturnValue({ level: 1, title: 'Apprentice', xpToNextLevel: 100 }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);

    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should return tokens and user for valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.login('test@example.com', 'password123');

      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.refresh_token).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.companyId).toBe('company-1');
    });

    it('should throw UnauthorizedException for unknown email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login('unknown@example.com', 'password123'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.login('test@example.com', 'wrongpassword'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user has no memberships', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        memberships: [],
      });

      await expect(service.login('test@example.com', 'password123'))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register', () => {
    it('should create user, company, and return tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null); // no existing user
      mockPrisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          user: { create: jest.fn().mockResolvedValue({ id: 'new-user', email: 'new@example.com', name: 'New User' }) },
          company: { create: jest.fn().mockResolvedValue({ id: 'new-company', name: 'New Company', tier: 'BRONZE' }) },
          companyMember: {
            create: jest.fn().mockResolvedValue({
              companyId: 'new-company',
              role: 'SME_OWNER',
              company: { id: 'new-company', name: 'New Company' },
            }),
          },
        };
        return cb(tx);
      });

      const result = await service.register({
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
        companyName: 'New Company',
      });

      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.user.email).toBe('new@example.com');
    });

    it('should throw ConflictException for duplicate email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test',
        companyName: 'Test Co',
      })).rejects.toThrow(ConflictException);
    });
  });

  describe('refresh', () => {
    it('should throw UnauthorizedException for invalid refresh token', async () => {
      // The refresh token is stored in-memory, so any token not in the map should fail
      await expect(service.refresh('invalid-token'))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getProfile', () => {
    it('should return user profile with memberships', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        memberships: mockUser.memberships.map(m => ({
          companyId: m.companyId,
          company: { id: m.companyId, name: m.company.name },
          role: m.role,
        })),
      });

      const result = await service.getProfile('user-1');

      expect(result.email).toBe('test@example.com');
      expect(result.memberships).toHaveLength(1);
      expect(result.memberships[0].companyName).toBe('Test Company');
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('nonexistent'))
        .rejects.toThrow(UnauthorizedException);
    });
  });
});
