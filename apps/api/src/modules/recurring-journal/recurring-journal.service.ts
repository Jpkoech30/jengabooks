import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';

export interface RecurringJournalTemplateData {
    companyId: string;
    name: string;
    description: string;
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    entries: Array<{
        accountId: string;
        description: string;
        amount: number;
        direction: 'DEBIT' | 'CREDIT';
    }>;
    startDate: string;
    endDate?: string;
    nextRunDate?: string;
    dayOfMonth?: number;      // For MONTHLY: 1-31
    dayOfWeek?: number;       // For WEEKLY: 0=Sunday, 1=Monday, ...
    isActive: boolean;
    createdById: string;
}

@Injectable()
export class RecurringJournalService {
    private readonly logger = new Logger(RecurringJournalService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly ledgerService: LedgerService,
    ) { }

    /**
     * Create a recurring journal template
     */
    async create(data: RecurringJournalTemplateData) {
        // Validate at least one entry
        if (!data.entries || data.entries.length === 0) {
            throw new BadRequestException('At least one journal entry is required');
        }

        // Validate DEBIT total = CREDIT total
        const debitTotal = data.entries.filter(e => e.direction === 'DEBIT').reduce((s, e) => s + e.amount, 0);
        const creditTotal = data.entries.filter(e => e.direction === 'CREDIT').reduce((s, e) => s + e.amount, 0);
        if (Math.abs(debitTotal - creditTotal) > 0.01) {
            throw new BadRequestException(
                `Journal entries are unbalanced: DEBIT ${debitTotal} ≠ CREDIT ${creditTotal}`,
            );
        }

        // Calculate next run date
        const nextRunDate = data.nextRunDate || this.calculateNextRun(data);

        // Validate end date if provided
        if (data.endDate && new Date(data.endDate) <= new Date(data.startDate)) {
            throw new BadRequestException('End date must be after start date');
        }

        return this.prisma.recurringJournalTemplate.create({
            data: {
                companyId: data.companyId,
                name: data.name,
                description: data.description,
                frequency: data.frequency,
                entries: data.entries,
                startDate: new Date(data.startDate),
                endDate: data.endDate ? new Date(data.endDate) : null,
                nextRunDate: new Date(nextRunDate),
                dayOfMonth: data.dayOfMonth || null,
                dayOfWeek: data.dayOfWeek || null,
                isActive: data.isActive !== false,
                createdById: data.createdById,
            },
        });
    }

    /**
     * List templates for a company
     */
    async findAll(companyId: string, includeInactive = false) {
        const where: any = { companyId };
        if (!includeInactive) {
            where.isActive = true;
        }

        return this.prisma.recurringJournalTemplate.findMany({
            where,
            orderBy: { nextRunDate: 'asc' },
            include: {
                createdBy: { select: { id: true, name: true } },
            },
        });
    }

    /**
     * Get a single template by ID
     */
    async findOne(id: string, companyId: string) {
        const template = await this.prisma.recurringJournalTemplate.findFirst({
            where: { id, companyId },
        });
        if (!template) {
            throw new NotFoundException(`Recurring journal template ${id} not found`);
        }
        return template;
    }

    /**
     * Update a template
     */
    async update(id: string, companyId: string, data: Partial<RecurringJournalTemplateData>) {
        const existing = await this.findOne(id, companyId);

        // If entries changed, re-validate balance
        if (data.entries) {
            const debitTotal = data.entries.filter(e => e.direction === 'DEBIT').reduce((s, e) => s + e.amount, 0);
            const creditTotal = data.entries.filter(e => e.direction === 'CREDIT').reduce((s, e) => s + e.amount, 0);
            if (Math.abs(debitTotal - creditTotal) > 0.01) {
                throw new BadRequestException(`Entries unbalanced: DEBIT ${debitTotal} ≠ CREDIT ${creditTotal}`);
            }
        }

        return this.prisma.recurringJournalTemplate.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description,
                frequency: data.frequency,
                entries: data.entries,
                startDate: data.startDate ? new Date(data.startDate) : undefined,
                endDate: data.endDate ? new Date(data.endDate) : data.endDate === null ? null : undefined,
                dayOfMonth: data.dayOfMonth,
                dayOfWeek: data.dayOfWeek,
                isActive: data.isActive,
            },
        });
    }

    /**
     * Delete a template
     */
    async remove(id: string, companyId: string) {
        await this.findOne(id, companyId);
        return this.prisma.recurringJournalTemplate.delete({ where: { id } });
    }

    /**
     * Process all due templates — called by scheduler/worker
     * Returns number of journal entries created
     */
    async processDueTemplates(companyId?: string): Promise<number> {
        const now = new Date();
        const where: any = {
            isActive: true,
            nextRunDate: { lte: now },
        };
        if (companyId) {
            where.companyId = companyId;
        }

        const dueTemplates = await this.prisma.recurringJournalTemplate.findMany({
            where,
            include: {
                createdBy: { select: { id: true, name: true } },
            },
        });

        let created = 0;
        for (const template of dueTemplates) {
            try {
                await this.executeTemplate(template);
                created++;

                // Update next run date
                const nextRun = this.calculateNextRun(template);
                const isExpired = template.endDate && new Date(nextRun) > new Date(template.endDate);

                await this.prisma.recurringJournalTemplate.update({
                    where: { id: template.id },
                    data: {
                        lastRunDate: now,
                        nextRunDate: isExpired ? null : new Date(nextRun),
                        isActive: isExpired ? false : true,
                    },
                });

                this.logger.log(`Template ${template.name} (${template.id}) executed. Next run: ${nextRun}`);
            } catch (err) {
                this.logger.error(`Failed to execute template ${template.id}: ${err.message}`);
            }
        }

        return created;
    }

    /**
     * Execute a single template — creates journal entries via LedgerService
     */
    private async executeTemplate(template: any) {
        const entries = template.entries as Array<{
            accountId: string;
            description: string;
            amount: number;
            direction: 'DEBIT' | 'CREDIT';
        }>;

        // Create journal entries for each line in the template
        for (const entry of entries) {
            await this.ledgerService.createJournalEntry(template.companyId, {
                accountId: entry.accountId,
                description: `[Recurring] ${template.name} — ${entry.description}`,
                amount: entry.amount,
                direction: entry.direction,
                entryDate: new Date().toISOString(),
                postedById: template.createdById,
                reference: `RECUR-${template.id.slice(0, 8)}`,
            });
        }

        this.logger.log(`Template ${template.name}: created ${entries.length} journal entries`);
    }

    /**
     * Calculate the next run date based on frequency and current next run
     */
    private calculateNextRun(template: any): string {
        const baseDate = template.nextRunDate
            ? new Date(template.nextRunDate)
            : new Date(template.startDate);

        const next = new Date(baseDate);

        switch (template.frequency) {
            case 'DAILY':
                next.setDate(next.getDate() + 1);
                break;
            case 'WEEKLY':
                next.setDate(next.getDate() + 7);
                break;
            case 'MONTHLY':
                next.setMonth(next.getMonth() + 1);
                if (template.dayOfMonth) {
                    next.setDate(Math.min(template.dayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
                }
                break;
            case 'QUARTERLY':
                next.setMonth(next.getMonth() + 3);
                break;
            case 'YEARLY':
                next.setFullYear(next.getFullYear() + 1);
                break;
        }

        return next.toISOString();
    }
}
