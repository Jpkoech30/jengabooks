import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StatementTimeoutInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const tier = request.headers['x-tenant-tier'] || 'BRONZE';
    
    const timeoutMap: Record<string, number> = {
      BRONZE: 5000,
      GOLD: 30000,
      PLATINUM: 120000,
    };
    
    const timeout = timeoutMap[tier] || 5000;
    
    // Execute SET statement_timeout for PostgreSQL query timeout
    return from(
      this.prisma.$executeRaw`SELECT set_config('statement_timeout', ${String(timeout)}, true)`
    ).pipe(
      switchMap(() => {
        request.statementTimeout = timeout;
        return next.handle();
      })
    );
  }
}
