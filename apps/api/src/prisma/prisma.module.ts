import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import {
  LedgerRepository,
  AuthRepository,
  TenantRepository,
  MpesaRepository,
  InvoiceRepository,
  PayrollRepository,
  AuditRepository,
  SyncRepository,
  StatementRepository,
  CollaborationRepository,
  GamificationRepository,
  DocumentRepository,
  PendingReviewRepository,
  SandboxRepository,
} from './repositories';

@Global()
@Module({
  providers: [
    PrismaService,
    LedgerRepository,
    AuthRepository,
    TenantRepository,
    MpesaRepository,
    InvoiceRepository,
    PayrollRepository,
    AuditRepository,
    SyncRepository,
    StatementRepository,
    CollaborationRepository,
    GamificationRepository,
    DocumentRepository,
    PendingReviewRepository,
    SandboxRepository,
  ],
  exports: [
    PrismaService,
    LedgerRepository,
    AuthRepository,
    TenantRepository,
    MpesaRepository,
    InvoiceRepository,
    PayrollRepository,
    AuditRepository,
    SyncRepository,
    StatementRepository,
    CollaborationRepository,
    GamificationRepository,
    DocumentRepository,
    PendingReviewRepository,
    SandboxRepository,
  ],
})
export class PrismaModule { }
