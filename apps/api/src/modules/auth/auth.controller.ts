import { Controller, Post, Get, Body, UseGuards, Req, UnauthorizedException, Res, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SwitchCompanyDto } from './dto/switch-company.dto';
import { RefreshTokenDto } from './dto/refresh.dto';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(body.email, body.password);
    
    // Set httpOnly cookie for XSS protection
    res.cookie('jengabooks_token', result.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });

    return result;
  }

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 registration attempts per minute
  async register(@Body() body: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(body);
    
    // Set httpOnly cookie for XSS protection
    res.cookie('jengabooks_token', result.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });

    return result;
  }

  @Post('refresh')
  async refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('jengabooks_token', { path: '/' });
    return { message: 'Logged out successfully' };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() req: any) {
    return this.authService.getProfile(req.user.userId);
  }

  @Post('switch-company')
  @UseGuards(JwtAuthGuard)
  async switchCompany(@Req() req: any, @Body() body: SwitchCompanyDto, @Res({ passthrough: true }) res: Response) {
    const membership = await this.prisma.companyMember.findUnique({
      where: {
        userId_companyId: { userId: req.user.userId, companyId: body.companyId },
      },
      include: { company: true },
    });

    if (!membership || !membership.isActive) {
      throw new UnauthorizedException('Not a member of this company');
    }

    const payload = {
      sub: req.user.userId,
      email: req.user.email,
      companyId: membership.companyId,
      role: membership.role,
    };

    const access_token = this.jwtService.sign(payload);

    // Update httpOnly cookie with new token
    res.cookie('jengabooks_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });

    return {
      access_token,
      user: {
        id: req.user.userId,
        email: req.user.email,
        name: req.user.name,
        companyId: membership.companyId,
        companyName: membership.company.name,
        role: membership.role,
      },
    };
  }
}
