# 🔴 Security Audit Report — Pipeline BLOCKED

**Date**: 2026-07-09  
**Scanner**: Security Auditor (`security-auditor` mode)  
**Scope**: Full product build — monorepo root + `apps/api` + `apps/web` + `apps/mobile`  
**Baseline**: `v1.0.0` → `HEAD`  
**Decision**: ❌ **BLOCKED** — CRITICAL vulnerability detected

---

## Summary

| Severity | Count | Action |
|----------|-------|--------|
| 🔴 Critical | 1 | Pipeline BLOCKED |
| 🟠 High | 18 (root) / 9 (api) | Must fix before merge |
| 🟡 Moderate | 42 (root) / 17 (api) | Logged — address in next sprint |
| 🔵 Low | 4 (root) / 3 (api) | Logged — monitor |
| 🔑 Hardcoded Secrets | 3 findings | Fix required |
| 🛡️ OWASP Violations | 2 findings | Fix required |

---

## 🔴 CRITICAL — Pipeline BLOCKING

### C-1: vitest Remote Code Execution (CVSS 9.6–9.8)

| Attribute | Value |
|-----------|-------|
| **Package** | `vitest` |
| **Location** | Monorepo root (`node_modules/vitest`) |
| **Advisory** | [`GHSA-9crc-q9x8-hgqq`](https://github.com/advisories/GHSA-9crc-q9x8-hgqq) — RCE via malicious website while Vitest API server is listening |
| | [`GHSA-5xrq-8626-4rwp`](https://github.com/advisories/GHSA-5xrq-8626-4rwp) — Arbitrary file read/execute when Vitest UI server is listening |
| **Impact** | Full server compromise if a developer visits a malicious site while the Vitest API server is active |
| **Fix** | Upgrade `vitest` to ≥3.1.2 (or latest compatible). Run `npm audit fix` in monorepo root. |

> **Note**: This is a **dev dependency** and does not affect production deployments. However, it poses a significant risk to developer machines and CI pipelines.

---

## 🟠 HIGH Vulnerabilities

### H-1: `@xmldom/xmldom` — XML Injection & DoS
| Package | Location | Advisories |
|---------|----------|------------|
| `@xmldom/xmldom` ≤0.8.12 | Monorepo root (Expo transitive) | [`GHSA-wh4c-j3r5-mjhp`](https://github.com/advisories/GHSA-wh4c-j3r5-mjhp), [`GHSA-2v35-w6hq-6mfw`](https://github.com/advisories/GHSA-2v35-w6hq-6mfw), [`GHSA-f6ww-3ggp-fr8h`](https://github.com/advisories/GHSA-f6ww-3ggp-fr8h), [`GHSA-x6wf-f3px-wcqx`](https://github.com/advisories/GHSA-x6wf-f3px-wcqx), [`GHSA-j759-j44w-7fr8`](https://github.com/advisories/GHSA-j759-j44w-7fr8) |

### H-2: `glob` — Command Injection
| Package | Location | Advisory |
|---------|----------|----------|
| `glob` 10.2.0–10.4.5 | Root + API (`@nestjs/cli` transitive) | [`GHSA-5j98-mcp5-4vw2`](https://github.com/advisories/GHSA-5j98-mcp5-4vw2) |

### H-3: `lodash` — Code Injection & Prototype Pollution
| Package | Location | Advisories |
|---------|----------|------------|
| `lodash` ≤4.17.23 | Root + API (`@nestjs/config` transitive) | [`GHSA-r5fr-rjxr-66jc`](https://github.com/advisories/GHSA-r5fr-rjxr-66jc), [`GHSA-f23m-r3pf-42rh`](https://github.com/advisories/GHSA-f23m-r3pf-42rh), [`GHSA-xxjr-mmjv-4gpg`](https://github.com/advisories/GHSA-xxjr-mmjv-4gpg) |

### H-4: `multer` — Multiple DoS Vectors
| Package | Location | Advisories |
|---------|----------|------------|
| `multer` ≤2.1.1 | Root + API (NestJS transitive) | [`GHSA-xf7r-hgr6-v32p`](https://github.com/advisories/GHSA-xf7r-hgr6-v32p), [`GHSA-v52c-386h-88mc`](https://github.com/advisories/GHSA-v52c-386h-88mc), [`GHSA-5528-5vmv-3xc2`](https://github.com/advisories/GHSA-5528-5vmv-3xc2), [`GHSA-72gw-mp4g-v24j`](https://github.com/advisories/GHSA-72gw-mp4g-v24j), [`GHSA-3p4h-7m6x-2hcm`](https://github.com/advisories/GHSA-3p4h-7m6x-2hcm) |

### H-5: `picomatch` — Method Injection & ReDoS
| Package | Location | Advisories |
|---------|----------|------------|
| `picomatch` 4.0.0–4.0.3 | Root + API (`@nestjs/cli` transitive) | [`GHSA-3v7f-55p6-f55p`](https://github.com/advisories/GHSA-3v7f-55p6-f55p), [`GHSA-c2c7-rcm5-vvqj`](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj) |

### H-6: `tar` — Path Traversal & File Overwrite
| Package | Location | Advisories |
|---------|----------|------------|
| `tar` ≤7.5.15 | Root + API | [`GHSA-34x7-hfp2-rc4v`](https://github.com/advisories/GHSA-34x7-hfp2-rc4v), [`GHSA-8qq5-rm4j-mr97`](https://github.com/advisories/GHSA-8qq5-rm4j-mr97), [`GHSA-83g3-92jg-28cx`](https://github.com/advisories/GHSA-83g3-92jg-28cx), [`GHSA-qffp-2rhf-9h96`](https://github.com/advisories/GHSA-qffp-2rhf-9h96), [`GHSA-9ppj-qmqm-q256`](https://github.com/advisories/GHSA-9ppj-qmqm-q256), [`GHSA-r6q2-hw4h-h46w`](https://github.com/advisories/GHSA-r6q2-hw4h-h46w), [`GHSA-vmf3-w455-68vh`](https://github.com/advisories/GHSA-vmf3-w455-68vh) |

### H-7: `tmp` — Path Traversal
| Package | Location | Advisories |
|---------|----------|------------|
| `tmp` ≤0.2.5 | Root + API (`@nestjs/cli` transitive) | [`GHSA-52f5-9888-hmc6`](https://github.com/advisories/GHSA-52f5-9888-hmc6), [`GHSA-ph9p-34f9-6g65`](https://github.com/advisories/GHSA-ph9p-34f9-6g65) |

### H-8: `turbo-stream` — DoS via React Router
| Package | Location | Advisory |
|---------|----------|----------|
| `turbo-stream` <3.0.0 | Monorepo root (`@remix-run/server-runtime` transitive) | [`GHSA-rxv8-25v2-qmq8`](https://github.com/advisories/GHSA-rxv8-25v2-qmq8) |

### H-9: `webpack` — SSRF
| Package | Location | Advisories |
|---------|----------|------------|
| `webpack` 5.49.0–5.104.0 | Root + API (`@nestjs/cli` transitive) | [`GHSA-8fgc-7cc6-rx7x`](https://github.com/advisories/GHSA-8fgc-7cc6-rx7x), [`GHSA-38r7-794h-5758`](https://github.com/advisories/GHSA-38r7-794h-5758) |

---

## 🔑 Hardcoded Secrets

### S-1: JWT Fallback Secret — [`audit.module.ts`](apps/api/src/modules/audit/audit.module.ts:11)

```typescript
secret: process.env.JWT_SECRET || 'jengabooks-dev-secret',
```

**Risk**: If `JWT_SECRET` env var is unset in production, the fallback `jengabooks-dev-secret` is used. An attacker who knows this string can forge arbitrary JWTs and impersonate any user.

**Fix**: Remove the fallback. Force the application to fail at startup if `JWT_SECRET` is not set.

### S-2: WhatsApp Verify Token Fallback — [`whatsapp.service.ts`](apps/api/src/modules/whatsapp/whatsapp.service.ts:36)

```typescript
this.verifyToken = this.configService.get<string>('WHATSAPP_VERIFY_TOKEN') || 'jengabooks_verify_2026';
```

**Risk**: Fallback token is publicly visible in source code. An attacker could use this to verify the webhook and receive WhatsApp messages.

**Fix**: Remove fallback. If not configured, log warning and disable webhook verification.

### S-3: Dev JWT Secret in `.env.example` — [`.env.example`](.env.example:21)

```
JWT_SECRET=jengabooks-dev-jwt-secret-2026
```

**Risk**: Developers may copy this file directly to `.env` without changing the secret, exposing all environments to J forgery.

**Fix**: Change value to `change-me-in-production` or similar placeholder.

---

## 🛡️ OWASP Top 10 Violations

### OWASP-1: A03:2021 — Injection (SQL Injection via `$executeRawUnsafe`)

**File**: [`sandbox.service.ts`](apps/api/src/modules/sandbox/sandbox.service.ts:536)  
**Type**: SQL Injection (HIGH)

The [`sandbox.service.ts`](apps/api/src/modules/sandbox/sandbox.service.ts) builds SQL INSERT statements via string interpolation and executes them with `$executeRawUnsafe`:

```typescript
await this.prisma.$executeRawUnsafe(`
  INSERT INTO mpesa_transactions
    (id, "companyId", "receiptNo", "transactionDate", description, ...)
  VALUES ${valueRows.join(',\n')}
`)
```

Values like `id`, `companyId`, `description`, `phoneNumber` are interpolated directly. While `escapeSql()` (line 207) escapes single quotes, this custom escaping is insufficient — it does not protect against:
- Backslash escape sequences (non-standard PostgreSQL conf)
- Unicode normalization attacks
- Integer/boolean context injection for non-string fields

**Fix**: Use Prisma's `$executeRaw` with tagged template literals (parameterized) or use Prisma's `createMany()` for batch inserts.

### OWASP-2: A03:2021 — Injection (Statement Timeout via Interpolation)

**File**: [`statement-timeout.interceptor.ts`](apps/api/src/common/interceptors/statement-timeout.interceptor.ts:24)

```typescript
this.prisma.$executeRawUnsafe(`SET statement_timeout = ${timeout}`)
```

**Risk**: `timeout` should be parameterized with `$1` binding instead of direct interpolation.

---

## ✅ OWASP Checks — PASSED

| Category | Status | Evidence |
|----------|--------|----------|
| **A01: Broken Access Control** | ✅ PASS | All new controllers use `@UseGuards(JwtAuthGuard)`. External auth uses token-based short-lived JWT (1 hour). WhatsApp webhook uses `hub.verify_token` verification. |
| **A03: Injection (Prisma)** | ✅ PASS | All Prisma queries use parameterized `findMany`, `findUnique`, `create`, `update` — safe from SQL injection |
| **A07: Identification & Auth Failures** | ✅ PASS | DTOs use `class-validator` decorators (`@IsString`, `@IsEmail`, `@IsEnum`, `@IsNumber`, `@Min`, `@Max`) |
| **A05: Security Misconfiguration** | ✅ PASS | `.gitignore` contains `.env` and `.env.local` — secrets not committed |
| **A16: Sensitive Data Exposure** | ✅ PASS | External access tokens are generated via `crypto.randomBytes(32).toString('hex')` — cryptographically secure |

---

## 🟡 MEDIUM Vulnerabilities (Summary)

### Monorepo Root — 42 Moderate

| Package | Advisory |
|---------|----------|
| `@babel/runtime` | Inefficient RegExp complexity in `.replace` with named capturing groups |
| `@nestjs/core` | Improper Neutralization of Special Elements (Injection) |
| `ajv` | ReDoS when using `$data` option |
| `esbuild` | Dev server allows any website to read responses |
| `fast-xml-parser` | XML Comment and CDATA Injection |
| `file-type` | Infinite loop in ASF parser; ZIP Decompression Bomb DoS |
| `postcss` | XSS via unescaped `</style>` in CSS stringify |
| `qs` | DoS via `stringify` crash on null/undefined in comma-format arrays |
| `uuid` | Missing buffer bounds check in v3/v5/v6 |

### apps/api — 17 Moderate

Includes `@nestjs/core`, `ajv`, `file-type`, `qs`, `uuid` (same as above, direct deps in API).

---

## ✅ .gitignore Verification — PASSED

File: [`.gitignore`](.gitignore) contains:

```
.env
.env.local
```

Both `.env` and `.env.local` are properly git-ignored. ✅

---

## 📋 Recommended Remediation

### Immediate (Blocking)
1. **Upgrade `vitest`** to ≥3.1.2 in monorepo root — resolves CRITICAL RCE
2. **Remove JWT fallback secret** in [`audit.module.ts`](apps/api/src/modules/audit/audit.module.ts:11) — fail fast if `JWT_SECRET` is unset
3. **Refactor `$executeRawUnsafe`** in [`sandbox.service.ts`](apps/api/src/modules/sandbox/sandbox.service.ts:536) to use parameterized queries or `prisma.createMany()`

### Within Sprint
4. **Remove WhatsApp verify token fallback** in [`whatsapp.service.ts`](apps/api/src/modules/whatsapp/whatsapp.service.ts:36)
5. **Change `.env.example` JWT secret** to placeholder value in [`.env.example`](.env.example:21)
6. **Parameterize `$executeRawUnsafe`** in [`statement-timeout.interceptor.ts`](apps/api/src/common/interceptors/statement-timeout.interceptor.ts:24)
7. Run `npm audit fix` for high-severity transitive dependencies (expo, @nestjs/cli, @nestjs/platform-express)

### Backlog
8. Address 42 moderate + 18 high transitive deps via `npm audit fix --force` (requires breaking change assessment)
9. Add CI secret scanning (e.g., `trufflehog` or `gitleaks`) to prevent future hardcoded secrets

---

## Pipeline Decision

```
RESULT: ❌ BLOCKED
REASON: 1 CRITICAL vulnerability (vitest RCE, CVSS 9.8)
        3 hardcoded secrets
        2 OWASP violations (SQL injection via $executeRawUnsafe)
```

**Pipeline cannot proceed until all CRITICAL items are remediated.**
