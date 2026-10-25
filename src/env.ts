import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Resilient multi-path .env loader for local, Docker, and cPanel CloudLinux/Passenger
const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
];

for (const candidate of envCandidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
    break;
  }
}

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  BASE_URL: z.preprocess(
    (val) => {
      if (!val || val === '' || val === '/') return 'http://localhost:3000';
      if (typeof val === 'string' && !val.startsWith('http://') && !val.startsWith('https://')) {
        return `https://${val}`;
      }
      return val;
    },
    z.string().url()
  ).default('http://localhost:3000'),
  SESSION_SECRET: z.string().min(16).default('mentalweg-default-session-secret-change-in-production-32chars'),
  SMTP_HOST: z.string().default('mail.senaycreatives.com'),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VERIFIER_BASE_URL: z.string().url().default('http://127.0.0.1:4000'),
  VERIFIER_API_KEY: z.string().default('placeholder-verifier-key'),
  DATA_DIR: z.string().default('./data'),
  TURNSTILE_SECRET: z.string().optional(),
  PORT: z.coerce.number().int().default(3000),
  ADMIN_INITIAL_EMAIL: z.string().email().optional(),
  ADMIN_INITIAL_PASSWORD: z.string().min(6).optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
