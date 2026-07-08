const { PrismaClient } = require('@prisma/client');

async function test(url, label) {
  const p = new PrismaClient({ datasources: { db: { url } } });
  try {
    await p.$connect();
    const r = await p.$queryRawUnsafe('SELECT current_database() as db, version() as ver');
    console.log(`✓ ${label}:`, JSON.stringify(r));
    await p.$disconnect();
    return true;
  } catch (e) {
    console.log(`✗ ${label}:`, e.message);
    return false;
  }
}

async function main() {
  // Test direct to WSL IP
  await test('postgresql://postgres:postgres@192.168.1.180:5432/jengabooks?schema=public', 'WSL IP');
  // Test via localhost portproxy
  await test('postgresql://postgres:postgres@localhost:5432/jengabooks?schema=public', 'localhost');
}
main();
