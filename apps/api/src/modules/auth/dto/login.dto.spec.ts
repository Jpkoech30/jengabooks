import { validate } from 'class-validator';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';

describe('Auth DTO Validation', () => {
  describe('LoginDto', () => {
    it('should pass for valid email and password', async () => {
      const dto = new LoginDto();
      dto.email = 'test@example.com';
      dto.password = 'password123';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail for invalid email', async () => {
      const dto = new LoginDto();
      dto.email = 'not-an-email';
      dto.password = 'password123';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('email');
    });

    it('should fail for short password', async () => {
      const dto = new LoginDto();
      dto.email = 'test@example.com';
      dto.password = '12345';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('password');
    });

    it('should fail for empty email', async () => {
      const dto = new LoginDto();
      dto.email = '';
      dto.password = 'password123';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('RegisterDto', () => {
    it('should pass for valid registration data', async () => {
      const dto = new RegisterDto();
      dto.email = 'new@example.com';
      dto.password = 'password123';
      dto.name = 'John Doe';
      dto.companyName = 'Acme Ltd';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when name is missing', async () => {
      const dto = new RegisterDto();
      dto.email = 'new@example.com';
      dto.password = 'password123';
      dto.companyName = 'Acme Ltd';
      // name is not set
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.property === 'name')).toBe(true);
    });

    it('should fail when companyName is missing', async () => {
      const dto = new RegisterDto();
      dto.email = 'new@example.com';
      dto.password = 'password123';
      dto.name = 'John Doe';
      // companyName is not set
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.property === 'companyName')).toBe(true);
    });
  });
});
