import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
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
import { HealthScoreModule } from './modules/health-score/health-score.module';
import { WizardModule } from './modules/wizard/wizard.module';

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
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
