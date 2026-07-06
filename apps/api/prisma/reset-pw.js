const bcrypt = require('../node_modules/bcrypt');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const hash = await bcrypt.hash('password123', 10);
  console.log('Hash:', hash);
  
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL || 'postgresql://admin:changeme@localhost:5433/jengabooks' } }
  });
  
  await prisma.$connect();
  await prisma.$executeRaw`UPDATE users SET password = ${hash} WHERE email = 'admin@jengabooks.com'`;
  console.log('Password updated!');
  await prisma.$disconnect();
}

main().catch(console.error);
