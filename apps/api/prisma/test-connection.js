const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient({
    datasources: { db: { url: 'postgresql://postgres:jenga123@localhost:5432/jengabooks' } }
  });
  try {
    await prisma.$connect();
    const result = await prisma.$queryRaw`SELECT current_database() as db, version() as ver`;
    console.log('CONNECTED!', JSON.stringify(result));
    await prisma.$disconnect();
    process.exit(0);
  } catch(e) {
    console.log('FAILED:', e.message);
    process.exit(1);
  }
}
main();
