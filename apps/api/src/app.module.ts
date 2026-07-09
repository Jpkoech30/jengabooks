import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queues/queue.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { EtimsModule } from './modules/etims/etims.module';
import { MpesaModule } from './modules/mpesa/mpesa.module';
import { AiModule } from './modules/ai/ai.module';
import { SyncModule } from './modules/sync/sync.module';
import { HitlModule } from './modules/hitl/hitl.module';
import { ReportsModule } from './modules/reports/reports.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { StatementsModule } from './modules/statements/statements.module';
import { HealthScoreModule } from './modules/health-score/health-score.module';
import { WizardModule } from './modules/wizard/wizard.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { TaxModule } from './modules/tax/tax.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { PracticeModule } from './modules/practice/practice.module';
import { CollaborationModule } from './modules/collaboration/collaboration.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { AuditModule } from './modules/audit/audit.module';
import { CashflowModule } from './modules/cashflow/cashflow.module';
import { BillingModule } from './modules/billing/billing.module';
import { SandboxModule } from './modules/sandbox/sandbox.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Try multiple env file locations to handle different working directories:
      // - '.env' works when running from apps/api/ (npm run dev in the package)
      // - './apps/api/.env' works when running from the monorepo root (turbo dev)
      envFilePath: ['.env', './apps/api/.env'],
    }),
    // Global rate limiting: 120 requests per 60 seconds by default
    // Auth endpoints use stricter limits via @Throttle() decorators
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 120,
    }]),
    QueueModule,
    PrismaModule,
    AuthModule,
    TenantsModule,
    LedgerModule,
    EtimsModule,
    MpesaModule,
    AiModule,
    SyncModule,
    HitlModule,
    ReportsModule,
    GamificationModule,
    HealthScoreModule,
    WizardModule,
    DashboardModule,
    TaxModule,
    PayrollModule,
    StatementsModule,
    PracticeModule,
    CollaborationModule,
    DocumentsModule,
    AuditModule,
    CashflowModule,
    BillingModule,
    SandboxModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
