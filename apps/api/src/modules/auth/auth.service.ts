import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly gamificationService: GamificationService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { isActive: true },
          include: { company: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Use the first active membership for JWT context
    const membership = user.memberships[0];
    if (!membership) {
      throw new UnauthorizedException('User has no active company membership');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      companyId: membership.companyId,
      role: membership.role,
    };

    // Award daily login XP (once per day)
    await this.gamificationService.awardXp(
      user.id,
      membership.companyId,
      10,
      'Daily login',
    ).catch(() => {});

    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '24h' }),
      refresh_token: await this.generateRefreshToken(user.id),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        companyId: membership.companyId,
        companyName: membership.company.name,
        role: membership.role,
      },
    };
  }

  async register(data: {
    email: string;
    password: string;
    name: string;
    companyName: string;
  }) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user, company, and membership in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          name: data.name,
        },
      });

      const company = await tx.company.create({
        data: {
          name: data.companyName,
          tier: 'BRONZE',
        },
      });

      const membership = await tx.companyMember.create({
        data: {
          userId: user.id,
          companyId: company.id,
          role: 'SME_OWNER',
        },
        include: { company: true },
      });

      return { user, membership };
    });

    const payload = {
      sub: result.user.id,
      email: result.user.email,
      companyId: result.membership.companyId,
      role: result.membership.role,
    };

    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '24h' }),
      refresh_token: await this.generateRefreshToken(result.user.id),
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        companyId: result.membership.companyId,
        companyName: result.membership.company.name,
        role: result.membership.role,
      },
    };
  }

  async refresh(refreshToken: string, now?: Date) {
    const timestamp = now || new Date();
    const tokenHash = this.hashToken(refreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.expiresAt < timestamp) {
      if (stored) {
        // Clean up expired token
        await this.prisma.refreshToken.delete({ where: { id: stored.id } }).catch(() => {});
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
      include: {
        memberships: {
          where: { isActive: true },
          include: { company: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const membership = user.memberships[0];
    if (!membership) {
      throw new UnauthorizedException('User has no active company membership');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      companyId: membership.companyId,
      role: membership.role,
    };

    // Delete the old refresh token (rotation)
    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '24h' }),
      refresh_token: await this.generateRefreshToken(user.id),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        companyId: membership.companyId,
        companyName: membership.company.name,
        role: membership.role,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { isActive: true },
          include: { company: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      memberships: user.memberships.map((m) => ({
        companyId: m.companyId,
        companyName: m.company.name,
        role: m.role,
      })),
    };
  }

  /**
   * Generate a refresh token, store it in the database, and return the raw token.
   * Database-backed storage ensures stateless operation across restarts and multi-instance deployments.
   */
  private async generateRefreshToken(userId: string): Promise<string> {
    const rawToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    // Refresh token valid for 7 days
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId,
        expiresAt,
      },
    });

    return rawToken;
  }

  /**
   * Hash a token for secure storage. Uses SHA-256 since the token itself is already a cryptographically
   * random string, so the hash is purely for defense-in-depth against DB leaks.
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
