const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$connect()
  .then(() => p.$queryRawUnsafe('SELECT current_database() as db'))
  .then(r => { console.log('OK:', JSON.stringify(r)); return p.$disconnect(); })
  .catch(e => { console.log('FAIL:', e.message); process.exit(1); });
