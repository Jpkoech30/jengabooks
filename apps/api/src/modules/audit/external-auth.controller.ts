import { Controller, Post, Body, ValidationPipe } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtService } from '@nestjs/jwt';

class ExternalAuthDto {
  /** The access token received from the external access grant */
  token!: string;
}

/**
 * Public endpoint for external users (auditors, bank officers, KRA) to authenticate
 * using their temporary access token.
 * 
 * POST /api/v1/external/access
 * 
 * Returns a short-lived JWT limited to the granted access level.
 * No JWT authentication required — this is a public endpoint.
 */
@Controller('external')
export class ExternalAuthController {
  constructor(
    private readonly auditService: AuditService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('access')
  async authenticate(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    body: ExternalAuthDto,
  ) {
    const payload = await this.auditService.authenticateExternalToken(body.token);

    // Sign a short-lived JWT (1 hour) with scoped permissions
    const accessToken = this.jwtService.sign(
      {
        sub: payload.sub,
        companyId: payload.companyId,
        accessLevel: payload.accessLevel,
        recipientName: payload.recipientName,
        purpose: payload.purpose,
        type: 'external',
      },
      {
        expiresIn: '1h',
      },
    );

    return {
      accessToken,
      expiresIn: payload.expiresIn,
      companyId: payload.companyId,
      accessLevel: payload.accessLevel,
    };
  }
}
