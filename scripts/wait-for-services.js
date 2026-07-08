/**
 * JengaBooks — Service Dependency Waiter
 *
 * Blocks until PostgreSQL and Redis are both reachable.
 * Designed to be run before `npm run dev` to prevent the app from
 * starting in a degraded state.
 *
 * Usage:
 *   node scripts/wait-for-services.js
 *
 * Environment variables (from .env):
 *   DATABASE_URL  — PostgreSQL connection string
 *   REDIS_HOST    — Redis host (default: localhost)
 *   REDIS_PORT    — Redis port (default: 6379)
 */

const { PrismaClient } = require('@prisma/client');
const Redis = require('ioredis');

const MAX_RETRIES = 15;
const RETRY_DELAY_MS = 2000;

async function waitForPostgres() {
  const prisma = new PrismaClient();
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      await prisma.$connect();
      console.log('✓ PostgreSQL is ready');
      await prisma.$disconnect();
      return true;
    } catch (err) {
      console.log(`  ⏳ Waiting for PostgreSQL (${i}/${MAX_RETRIES})...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
  throw new Error('PostgreSQL did not become ready. Check that the service is running in WSL.');
}

async function waitForRedis() {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });

  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      await redis.connect();
      const ping = await redis.ping();
      if (ping === 'PONG') {
        console.log('✓ Redis is ready');
        redis.disconnect();
        return true;
      }
    } catch (_err) {
      // Connection failed, will retry
    }
    console.log(`  ⏳ Waiting for Redis (${i}/${MAX_RETRIES})...`);
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }
  throw new Error('Redis did not become ready. Check that the service is running in WSL.');
}

async function main() {
  console.log('\n🔍 Checking service dependencies...\n');

  try {
    await Promise.all([waitForPostgres(), waitForRedis()]);
    console.log('\n✅ All services are ready! Starting application...\n');
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ ${err.message}`);
    console.error('\n   Run the following inside WSL to diagnose:');
    console.error('   sudo service postgresql status');
    console.error('   sudo service redis-server status');
    console.error('   psql -h localhost -U postgres -d jengabooks -c "SELECT 1"');
    console.error('   redis-cli -h localhost ping\n');
    process.exit(1);
  }
}

main();
