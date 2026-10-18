import argon2 from 'argon2';
import crypto from 'crypto';

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch (err) {
    return false;
  }
}

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
