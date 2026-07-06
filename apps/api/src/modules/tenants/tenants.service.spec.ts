import { Test, TestingModule } from '@nestjs/testing';
import { TenantsService } from './tenants.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('TenantsService', () => {
  let service: TenantsService;
  let prisma: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        {
          provide: PrismaService,
          useValue: {
            company: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
            companyMember: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
            user: { findUnique: jest.fn(), create: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all companies for SUPER_ADMIN', async () => {
      prisma.company.findMany.mockResolvedValue([{ id: '1' }, { id: '2' }]);
      prisma.company.count.mockResolvedValue(2);
      const result = await service.findAll('user-1', 'SUPER_ADMIN');
      expect(result.items).toHaveLength(2);
    });

    it('should filter by user membership for regular users', async () => {
      prisma.company.findMany.mockResolvedValue([{ id: '1' }]);
      prisma.company.count.mockResolvedValue(1);
      const result = await service.findAll('user-1', 'SME_OWNER');
      expect(result.items).toHaveLength(1);
    });
  });

  describe('addMember', () => {
    it('should add a member to a company', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      prisma.companyMember.findUnique.mockResolvedValue(null);
      prisma.companyMember.create.mockResolvedValue({ id: 'm1', userId: 'u1', companyId: 'c1' });
      const result = await service.addMember('c1', { userId: 'u1', role: 'ACCOUNTANT' });
      expect(result).toBeDefined();
    });

    it('should throw when company not found', async () => {
      prisma.company.findUnique.mockResolvedValue(null);
      await expect(service.addMember('nonexistent', { userId: 'u1', role: 'ACCOUNTANT' }))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw when user already active member', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      prisma.companyMember.findUnique.mockResolvedValue({ id: 'm1', isActive: true });
      await expect(service.addMember('c1', { userId: 'u1', role: 'ACCOUNTANT' }))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('inviteByEmail', () => {
    it('should create user and add as member for new email', async () => {
      // First findUnique returns null (no existing user), second findUnique is from addMember
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // no existing user in inviteByEmail
        .mockResolvedValueOnce({ id: 'new-user', email: 'new@test.com', name: 'new' }); // found in addMember
      prisma.user.create.mockResolvedValue({ id: 'new-user', email: 'new@test.com', name: 'new' });
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.companyMember.findUnique.mockResolvedValue(null);
      prisma.companyMember.create.mockResolvedValue({ id: 'm1' });
      const result = await service.inviteByEmail('c1', { email: 'new@test.com', role: 'ACCOUNTANT' });
      expect(result).toBeDefined();
    });
  });
});
