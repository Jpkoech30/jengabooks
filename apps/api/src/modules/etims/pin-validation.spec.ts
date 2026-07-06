/**
 * KRA PIN Validation Tests
 *
 * KRA PIN format: 11 characters, alphanumeric, uppercase
 * Pattern: ^[A-Z0-9]{11}$
 * Example: P051234567Z
 *
 * Edge cases considered:
 * - Valid PIN with mixed letters and numbers
 * - PIN that is too short/long
 * - PIN with lowercase characters
 * - PIN with special characters
 * - Empty/null/undefined PIN
 * - PIN with spaces
 */

function isValidKraPin(pin: string | null | undefined): boolean {
  if (!pin) return false;
  // KRA PIN: 11 chars, uppercase A-Z + digits, must contain at least one digit
  return /^[A-Z0-9]{11}$/.test(pin) && /[0-9]/.test(pin);
}

describe('KRA PIN Validation', () => {
  // Valid PINs
  it('should accept a valid KRA PIN format (P051234567Z)', () => {
    expect(isValidKraPin('P051234567Z')).toBe(true);
  });

  it('should accept a valid KRA PIN with all digits (A123456789B)', () => {
    expect(isValidKraPin('A123456789B')).toBe(true);
  });

  it('should accept a valid KRA PIN with letters mixed (KRA0012345X)', () => {
    expect(isValidKraPin('KRA0012345X')).toBe(true);
  });

  // Invalid PINs
  it('should reject PIN that is too short (10 chars)', () => {
    expect(isValidKraPin('A12345678B')).toBe(false);
  });

  it('should reject PIN that is too long (12 chars)', () => {
    expect(isValidKraPin('A123456789BC')).toBe(false);
  });

  it('should reject PIN with lowercase letters', () => {
    expect(isValidKraPin('p051234567z')).toBe(false);
  });

  it('should reject PIN with special characters', () => {
    expect(isValidKraPin('A12*456789B')).toBe(false);
  });

  it('should reject empty string', () => {
    expect(isValidKraPin('')).toBe(false);
  });

  it('should reject null PIN', () => {
    expect(isValidKraPin(null)).toBe(false);
  });

  it('should reject undefined PIN', () => {
    expect(isValidKraPin(undefined)).toBe(false);
  });

  it('should reject PIN with spaces', () => {
    expect(isValidKraPin('A12 456789B')).toBe(false);
  });

  it('should reject PIN with only letters (no digits)', () => {
    expect(isValidKraPin('ABCDEFGHIJK')).toBe(false);
  });
});
