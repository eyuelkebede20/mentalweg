import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/services/auth.service';

describe('Auth Service', () => {
  it('should hash and verify passwords correctly', async () => {
    const password = 'mySuperSecretPassword123!';
    const hash = await hashPassword(password);
    
    expect(hash).not.toBe(password);
    
    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword('wrongpassword', hash);
    expect(isInvalid).toBe(false);
  }, 15000);
});
