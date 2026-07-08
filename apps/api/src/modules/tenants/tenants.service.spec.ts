import { Test, TestingModule } from '@nestjs/testing';
import { TenantsService } from './tenants.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('TenantsService', () => {
  let service: TenantsService;
  let prisma: any;

  const mockCompany = (id: string, name: string, tier = 'BRONZE') => ({
    id,
    name,
    tier,
    isActive: true,
    createdAt: new Date(),
    kraPin: null,
    parentCompanyId: null,
  });

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
            businessHealthScore: { findFirst: jest.fn() },
            pendingReview: { count: jest.fn() },
            eTIMSSubmission: { count: jest.fn() },
            journalEntry: { count: jest.fn() },
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

  describe('getFirmDashboard', () => {
    it('should return aggregated dashboard for user with multiple memberships', async () => {
      const companies = [
        mockCompany('c1', 'Acme Corp', 'GOLD'),
        mockCompany('c2', 'Beta Ltd', 'SILVER'),
      ];
      prisma.companyMember.findMany.mockResolvedValue([
        { companyId: 'c1', role: 'ACCOUNTANT', company: companies[0] },
        { companyId: 'c2', role: 'ACCOUNTANT', company: companies[1] },
      ]);
      // First client: healthy
      prisma.businessHealthScore.findFirst.mockResolvedValueOnce({ overallScore: 85 });
      prisma.pendingReview.count.mockResolvedValueOnce(0);
      prisma.eTIMSSubmission.count.mockResolvedValueOnce(0);
      prisma.journalEntry.count.mockResolvedValueOnce(150);
      // Second client: needs attention (low health + pending reviews)
      prisma.businessHealthScore.findFirst.mockResolvedValueOnce({ overallScore: 45 });
      prisma.pendingReview.count.mockResolvedValueOnce(3);
      prisma.eTIMSSubmission.count.mockResolvedValueOnce(1);
      prisma.journalEntry.count.mockResolvedValueOnce(72);

      const result = await service.getFirmDashboard('user-1');

      expect(result.totalClients).toBe(2);
      expect(result.needingAttention).toBe(1); // only c2
      expect(result.totalPendingReviews).toBe(3);
      expect(result.totalFailedEtims).toBe(1);
      expect(result.clients).toHaveLength(2);
      expect(result.clients[0].name).toBe('Acme Corp');
      expect(result.clients[0].healthScore).toBe(85);
      expect(result.clients[1].name).toBe('Beta Ltd');
      expect(result.clients[1].healthScore).toBe(45);
    });

    it('should return empty dashboard for user with no memberships', async () => {
      prisma.companyMember.findMany.mockResolvedValue([]);

      const result = await service.getFirmDashboard('user-1');

      expect(result.totalClients).toBe(0);
      expect(result.needingAttention).toBe(0);
      expect(result.totalPendingReviews).toBe(0);
      expect(result.totalFailedEtims).toBe(0);
      expect(result.clients).toHaveLength(0);
    });

    it('should handle null health scores gracefully', async () => {
      prisma.companyMember.findMany.mockResolvedValue([
        { companyId: 'c1', role: 'ACCOUNTANT', company: mockCompany('c1', 'Startup Inc') },
      ]);
      // No health score exists for this company
      prisma.businessHealthScore.findFirst.mockResolvedValueOnce(null);
      prisma.pendingReview.count.mockResolvedValueOnce(0);
      prisma.eTIMSSubmission.count.mockResolvedValueOnce(0);
      prisma.journalEntry.count.mockResolvedValueOnce(10);

      const result = await service.getFirmDashboard('user-1');

      expect(result.totalClients).toBe(1);
      expect(result.needingAttention).toBe(0); // null health doesn't count as needing attention
      expect(result.clients[0].healthScore).toBeNull();
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
