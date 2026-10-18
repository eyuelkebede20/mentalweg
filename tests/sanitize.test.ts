import { describe, it, expect } from 'vitest';
import { sanitizeText, sanitizeEmail, normalizeEthiopianPhone } from '../src/utils/sanitize';

describe('Sanitization & Phone Normalization', () => {
  it('should strip HTML tags and escape dangerous characters', () => {
    const raw = '<script>alert("hack")</script><b>John & Jane</b>';
    const clean = sanitizeText(raw);
    expect(clean).not.toContain('<script>');
    expect(clean).toContain('alert(&quot;hack&quot;)');
    expect(clean).toContain('John &amp; Jane');
  });

  it('should normalize Ethiopian phone numbers correctly', () => {
    expect(normalizeEthiopianPhone('0911234567')).toBe('+251911234567');
    expect(normalizeEthiopianPhone('0712345678')).toBe('+251712345678');
    expect(normalizeEthiopianPhone('+251 91 123 4567')).toBe('+251911234567');
    expect(normalizeEthiopianPhone('251911234567')).toBe('+251911234567');
    expect(normalizeEthiopianPhone('00251911234567')).toBe('+251911234567');
  });

  it('should reject invalid Ethiopian phone numbers', () => {
    expect(() => normalizeEthiopianPhone('12345')).toThrow();
    expect(() => normalizeEthiopianPhone('0811234567')).toThrow(); // Starts with 8 instead of 9 or 7
    expect(() => normalizeEthiopianPhone('+12345678901')).toThrow();
  });

  it('should validate and sanitize emails', () => {
    expect(sanitizeEmail('  Hana.Almaz@Example.COM ')).toBe('hana.almaz@example.com');
    expect(sanitizeEmail('invalid-email')).toBeUndefined();
    expect(sanitizeEmail('')).toBeUndefined();
  });
});
