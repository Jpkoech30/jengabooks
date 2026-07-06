// Database configuration is managed directly in PrismaService via DATABASE_URL env var.
// This file is intentionally left as a reference — no longer used.
// See: src/prisma/prisma.service.ts
export default () => ({
  database: {
    url: process.env.DATABASE_URL,
  },
});
