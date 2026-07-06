import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RlsSetterInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RlsSetterInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const companyId = request.user?.companyId;

    if (companyId) {
      // Execute SET LOCAL for Row-Level Security in PostgreSQL
      return from(
        this.prisma.$executeRawUnsafe(`SELECT set_config('app.current_company', $1, true)`, companyId)
      ).pipe(
        switchMap(() => {
          request.tenantId = companyId;
          return next.handle();
        })
      );
    }

    return next.handle();
  }
}
