import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  BASE_URL: z.string().url().default('http://localhost:3000'),
  SESSION_SECRET: z.string().min(32),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VERIFIER_BASE_URL: z.string().url(),
  VERIFIER_API_KEY: z.string().min(1),
  DATA_DIR: z.string().default('./data'),
  TURNSTILE_SECRET: z.string().optional(),
  PORT: z.coerce.number().int().default(3000),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
