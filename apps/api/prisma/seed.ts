import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Create a demo company (replaces old tenant concept)
  const company = await prisma.company.upsert({
    where: { id: 'demo-company-001' },
    update: {},
    create: {
      id: 'demo-company-001',
      name: 'Demo Accounting Firm',
      tier: 'GOLD',
      kraPin: 'P051234567A',
    },
  });

  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create admin user
  const user = await prisma.user.upsert({
    where: { email: 'admin@jengabooks.com' },
    update: {},
    create: {
      email: 'admin@jengabooks.com',
      password: hashedPassword,
      name: 'Admin User',
    },
  });

  // Link user to company as FIRM_OWNER
  await prisma.companyMember.upsert({
    where: { userId_companyId: { userId: user.id, companyId: company.id } },
    update: {},
    create: {
      userId: user.id,
      companyId: company.id,
      role: 'FIRM_OWNER',
    },
  });

  // Create default chart of accounts (scoped to companyId, not tenantId)
  const accounts = [
    { code: '1000', name: 'Cash', type: 'ASSET' },
    { code: '1100', name: 'Accounts Receivable', type: 'ASSET' },
    { code: '2000', name: 'Accounts Payable', type: 'LIABILITY' },
    { code: '3000', name: 'Owner Equity', type: 'EQUITY' },
    { code: '4000', name: 'Sales Revenue', type: 'INCOME' },
    { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE' },
    { code: '6000', name: 'Operating Expenses', type: 'EXPENSE' },
  ];

  for (const account of accounts) {
    await prisma.chartOfAccount.upsert({
      where: { companyId_code: { companyId: company.id, code: account.code } },
      update: {},
      create: { ...account, companyId: company.id },
    });
  }

  console.log('Seed completed successfully');
  console.log(`  Company: ${company.name} (${company.id})`);
  console.log(`  Admin: admin@jengabooks.com`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
