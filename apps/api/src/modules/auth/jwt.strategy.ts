import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      Logger.warn(
        'JWT_SECRET environment variable is not set! Using a random ephemeral secret. ' +
        'All existing sessions will be invalidated on server restart. ' +
        'Set JWT_SECRET in your .env file for production.',
        JwtStrategy.name,
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        JwtStrategy.fromCookie,
      ]),
      ignoreExpiration: false,
      secretOrKey: secret || require('crypto').randomBytes(64).toString('hex'),
    });
  }

  private static fromCookie(req: Request): string | null {
    if (req?.cookies?.jengabooks_token) {
      return req.cookies.jengabooks_token;
    }
    return null;
  }

  async validate(payload: { sub: string; email: string; companyId: string; role: string }) {
    return {
      userId: payload.sub,
      email: payload.email,
      companyId: payload.companyId,
      role: payload.role,
    };
  }
}
