import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards, Res, HttpCode } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Response } from 'express';
import * as crypto from 'crypto';

@Controller('shareable-links')
@UseGuards(JwtAuthGuard)
export class ShareableLinksController {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Create a shareable report link with TTL expiry
     */
    @Post()
    async create(@Req() req: any, @Body() body: { reportType: string; params?: any; expiresInDays?: number }) {
        const companyId = req.user.companyId;
        const token = crypto.randomBytes(32).toString('hex');
        const expiresInDays = body.expiresInDays || 7;

        const link = await this.prisma.externalAccess.create({
            data: {
                companyId,
                grantorId: req.user.userId,
                recipientName: 'Shareable Link',
                recipientEmail: null,
                accessLevel: 'VIEW_ONLY',
                accessToken: token,
                expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
                purpose: 'SHAREABLE_REPORT_LINK',
            },
        });

        return {
            id: link.id,
            url: `/api/v1/share/${token}`,
            reportType: body.reportType,
            params: body.params || {},
            expiresAt: link.expiresAt,
            createdBy: req.user.userId,
        };
    }

    /**
     * List all shareable links for the current company
     */
    @Get()
    async findAll(@Req() req: any) {
        const links = await this.prisma.externalAccess.findMany({
            where: {
                companyId: req.user.companyId,
                purpose: 'SHAREABLE_REPORT_LINK',
                isRevoked: false,
            },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                accessToken: true,
                expiresAt: true,
                lastAccessedAt: true,
                createdAt: true,
                isRevoked: true,
            },
        });

        return links.map((l) => ({
            id: l.id,
            url: `/api/v1/share/${l.accessToken}`,
            expiresAt: l.expiresAt,
            lastAccessedAt: l.lastAccessedAt,
            createdAt: l.createdAt,
            isExpired: l.expiresAt < new Date(),
            isRevoked: l.isRevoked,
        }));
    }

    /**
     * Revoke a shareable link
     */
    @Delete(':id')
    @HttpCode(204)
    async revoke(@Req() req: any, @Param('id') id: string) {
        await this.prisma.externalAccess.updateMany({
            where: { id, companyId: req.user.companyId, purpose: 'SHAREABLE_REPORT_LINK' },
            data: { isRevoked: true },
        });
    }
}

/**
 * Public controller for accessing shareable links (no auth required - uses token)
 */
@Controller('share')
export class ShareAccessController {
    constructor(private readonly prisma: PrismaService) { }

    @Get(':token')
    async accessByToken(@Param('token') token: string, @Res() res: Response) {
        const access = await this.prisma.externalAccess.findUnique({
            where: { accessToken: token },
            include: { company: { select: { name: true } } },
        });

        if (!access || access.isRevoked || access.expiresAt < new Date()) {
            return res.status(410).json({
                error: 'Link expired or revoked',
                message: 'This shareable link is no longer valid. Please request a new one.',
            });
        }

        // Log access
        await this.prisma.externalAccessLog.create({
            data: {
                accessId: access.id,
                action: 'VIEW_REPORT',
                resourceType: 'REPORT',
                resourceId: null,
            },
        });

        // Update last accessed
        await this.prisma.externalAccess.update({
            where: { id: access.id },
            data: { lastAccessedAt: new Date() },
        });

        return res.json({
            company: access.company.name,
            accessLevel: access.accessLevel,
            expiresAt: access.expiresAt,
        });
    }
}
