# JengaBooks - CLAUDE.md

## Project Context
Multi-tenant Kenyan accounting SaaS (NestJS + Postgres + Redis + React/Expo)

## Commands
- `npm run dev` — Start all workspaces in dev mode
- `npm run build` — Build all workspaces
- `npm run lint` — Lint all workspaces

## Architecture Constraints
- ALL Node.js instances must be stateless (no in-memory state)
- Redis is the centralized State Engine (AOF + RDB durability)
- Every DB table includes tenant_id for Row-Level Security
- JWT is the sole session state (no Redis sessions)
- Soft-delete on all financial data (no hard deletes)
- 48px minimum touch targets on all interactive elements
- fontSize: 16 on all mobile inputs to prevent iOS zoom

## Key Files
- Schema: `apps/api/prisma/schema.prisma`
- API Entry: `apps/api/src/main.ts`
- App Module: `apps/api/src/app.module.ts`
- Web Entry: `apps/web/src/main.tsx`
- Mobile Entry: `apps/mobile/src/_layout.tsx`
- Shared Types: `packages/shared/src/`

## Tech Stack
NestJS 10 · Prisma 5 · PostgreSQL 15 · Redis 7 · BullMQ · DeepSeek V4 · React 18 · Vite · Expo 51 · WatermelonDB

## Design Tokens
- Primary: Acacia Green #0A5C36
- Secondary: Golden Amber #E8A317
- Error: Kenyan Red #BB1E10
- Surface Light: #FBF8F1
- Surface Dark: #1A1A1F

## RBAC Roles
SUPER_ADMIN · FIRM_OWNER · TENANT_ADMIN · ACCOUNTANT · SME_OWNER · AUDITOR · BANK_OFFICER

## Deployment
Target: Vultr Johannesburg (South Africa)
Stack: Docker Compose → Vultr High Frequency VMs → Managed Databases
