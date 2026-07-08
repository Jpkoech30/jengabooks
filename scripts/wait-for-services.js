#!/usr/bin/env node
/**
 * JengaBooks — Service Dependency Waiter
 *
 * Waits for critical infrastructure (PostgreSQL, Redis) to be ready before
 * the app starts. Also performs non-blocking checks on optional 3rd party APIs.
 *
 * Environment variables (from .env or exported by dev.ps1):
 *   DATABASE_URL  — PostgreSQL connection string
 *   REDIS_HOST    — Redis host (default: localhost)
 *   REDIS_PORT    — Redis port (default: 6379)
 *   DEEPSEEK_API_KEY — (optional) DeepSeek AI API key
 *   KRA_API_URL      — (optional) KRA eTIMS API base URL
 *
 * Usage:
 *   node scripts/wait-for-services.js
 */

const { PrismaClient } = require('@prisma/client');
const Redis = require('ioredis');
const https = require('https');
const http = require('http');

const MAX_RETRIES = 15;
const RETRY_DELAY_MS = 2000;

// ─── PostgreSQL ───────────────────────────────────────────────────────────────

async function waitForPostgres() {
  const prisma = new PrismaClient();
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      await prisma.$connect();
      // Verify we can actually run a query
      const result = await prisma.$queryRawUnsafe('SELECT 1 as ok');
      console.log('✓ PostgreSQL is ready');
      await prisma.$disconnect();
      return true;
    } catch (err) {
      console.log(`  ⏳ Waiting for PostgreSQL (${i}/${MAX_RETRIES})...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
  throw new Error(
    'PostgreSQL did not become ready. Check that the service is running.\n' +
      '  - WSL:  sudo service postgresql status\n' +
      '  - Docker: docker-compose ps postgres'
  );
}

// ─── Redis ────────────────────────────────────────────────────────────────────

async function waitForRedis() {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    retryStrategy: () => null, // Don't auto-retry, we handle it manually
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
  redis.disconnect();
  throw new Error(
    'Redis did not become ready. Check that the service is running.\n' +
      '  - WSL:  sudo service redis-server status\n' +
      '  - Docker: docker-compose ps redis'
  );
}

// ─── 3rd Party API Checks (non-blocking) ─────────────────────────────────────

/**
 * Check DNS resolution + TCP connectivity for a given host.
 * Returns { ok, ms } or { ok: false, error: string }.
 */
function checkHostReachable(host, port = 443, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new (port === 443 ? https : http).request(
      {
        host,
        port,
        method: 'HEAD',
        path: '/',
        timeout: timeoutMs,
        rejectUnauthorized: false,
      },
      (res) => {
        const ms = Date.now() - start;
        socket.destroy();
        resolve({ ok: true, ms, statusCode: res.statusCode });
      }
    );
    socket.on('error', (err) => {
      socket.destroy();
      resolve({ ok: false, error: err.message });
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ ok: false, error: 'timeout' });
    });
    socket.end();
  });
}

async function checkThirdPartyApis() {
  const checks = [];
  let anyFailed = false;

  // DeepSeek AI API
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey && deepseekKey !== 'placeholder') {
    checks.push(
      checkHostReachable('api.deepseek.com').then((r) => {
        if (r.ok) {
          console.log(`  ✓ DeepSeek AI API reachable (${r.ms}ms)`);
        } else {
          console.warn(`  ⚠ DeepSeek AI API unreachable: ${r.error}`);
          anyFailed = true;
        }
      })
    );
  } else {
    console.log('  - DeepSeek AI API: skipped (no API key configured)');
  }

  // KRA eTIMS API (mock or real)
  const kraUrl = process.env.KRA_API_URL;
  if (kraUrl) {
    try {
      const parsed = new URL(kraUrl);
      checks.push(
        checkHostReachable(parsed.hostname, parsed.port || 443).then((r) => {
          if (r.ok) {
            console.log(`  ✓ KRA eTIMS API reachable (${r.ms}ms)`);
          } else {
            console.warn(`  ⚠ KRA eTIMS API unreachable: ${r.error}`);
            anyFailed = true;
          }
        })
      );
    } catch {
      console.warn(`  ⚠ KRA_API_URL is not a valid URL: ${kraUrl}`);
      anyFailed = true;
    }
  } else {
    console.log('  - KRA eTIMS API: skipped (no KRA_API_URL configured)');
  }

  await Promise.all(checks);

  if (anyFailed) {
    console.log(
      '  ℹ Some optional APIs are unreachable. The app will start in degraded mode for those features.'
    );
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔍 Checking service dependencies...\n');

  try {
    // Blocking checks — app won't start without these
    await Promise.all([waitForPostgres(), waitForRedis()]);
    console.log('');

    // Non-blocking checks — just informational
    console.log('🔌 Checking 3rd party APIs...');
    await checkThirdPartyApis();

    console.log('\n✅ All services are ready! Starting application...\n');
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ ${err.message}`);
    console.error('\n📋 Troubleshooting:');
    console.error('   1. Ensure WSL is running: wsl -d Ubuntu -u root -- echo "ok"');
    console.error('   2. Start PostgreSQL: wsl -d Ubuntu -u root -- service postgresql start');
    console.error('   3. Start Redis:      wsl -d Ubuntu -u root -- service redis-server start');
    console.error('   4. Test manually:     node scripts/test-conn2.js\n');
    process.exit(1);
  }
}

main();
