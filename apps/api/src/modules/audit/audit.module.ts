import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { ExternalAuthController } from './external-auth.controller';
import { LockDownGuard } from './guards/lock-down.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'jengabooks-dev-secret',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AuditController, ExternalAuthController],
  providers: [AuditService, LockDownGuard],
  exports: [AuditService, LockDownGuard],
})
export class AuditModule {}
