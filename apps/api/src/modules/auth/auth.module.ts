import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  console.warn('WARNING: JWT_SECRET environment variable is not set! Using an ephemeral secret. All sessions will be invalidated on restart.');
}

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: jwtSecret || require('crypto').randomBytes(64).toString('hex'),
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}
