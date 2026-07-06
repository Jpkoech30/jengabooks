/**
 * Auth E2E Tests
 *
 * Full HTTP request/response cycle.
 * Requires a test database (jengabooks_test) or uses the existing database.
 *
 * Run: npx jest --config jest-e2e.config.ts
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Auth (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({ where: { email: { contains: 'e2e-test' } } }).catch(() => {});
    await app.close();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user and return tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'e2e-test-user@example.com',
          password: 'password123',
          name: 'E2E Test User',
          companyName: 'E2E Test Company',
        })
        .expect(201);

      expect(res.body.access_token).toBeDefined();
      expect(res.body.refresh_token).toBeDefined();
      expect(res.body.user.email).toBe('e2e-test-user@example.com');
      expect(res.body.user.companyName).toBe('E2E Test Company');
    });

    it('should reject duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'e2e-test-user@example.com',
          password: 'password123',
          name: 'Duplicate',
          companyName: 'Test Co',
        })
        .expect(409);
    });

    it('should reject invalid registration data', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', password: 'short', name: '', companyName: '' })
        .expect(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'e2e-test-user@example.com', password: 'password123' })
        .expect(201);

      expect(res.body.access_token).toBeDefined();
      expect(res.body.user.email).toBe('e2e-test-user@example.com');
    });

    it('should reject wrong password', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'e2e-test-user@example.com', password: 'wrongpassword' })
        .expect(401);
    });

    it('should reject unknown email', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'unknown@example.com', password: 'password123' })
        .expect(401);
    });
  });

  describe('GET /api/v1/auth/profile', () => {
    it('should return profile with valid token', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'e2e-test-user@example.com', password: 'password123' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${loginRes.body.access_token}`)
        .expect(200);

      expect(res.body.email).toBe('e2e-test-user@example.com');
      expect(res.body.memberships).toBeDefined();
    });

    it('should reject without token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .expect(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should return new tokens with valid refresh token', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'e2e-test-user@example.com', password: 'password123' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: loginRes.body.refresh_token })
        .expect(201);

      expect(res.body.access_token).toBeDefined();
      expect(res.body.refresh_token).toBeDefined();
    });

    it('should reject invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });

    it('should reject empty refresh token body', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({})
        .expect(401);
    });
  });

  describe('Full user flow', () => {
    it('should complete register → login → profile → refresh cycle', async () => {
      // Register
      const registerRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'e2e-test-flow@example.com',
          password: 'password123',
          name: 'Flow Test',
          companyName: 'Flow Company',
        })
        .expect(201);

      // Login
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'e2e-test-flow@example.com', password: 'password123' })
        .expect(201);

      // Profile
      await request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${loginRes.body.access_token}`)
        .expect(200);

      // Refresh
      const refreshRes = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: loginRes.body.refresh_token })
        .expect(201);

      expect(refreshRes.body.access_token).toBeDefined();
      expect(refreshRes.body.refresh_token).not.toBe(loginRes.body.refresh_token);
    });
  });
});
