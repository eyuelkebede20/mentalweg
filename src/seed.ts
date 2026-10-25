import { db } from './db';
import { adminTable } from './db/schema';
import { hashPassword } from './services/auth.service';

export async function seedInitialAdmin() {
  try {
    const existing = await db.select().from(adminTable).limit(1);
    if (existing.length === 0) {
      const email = process.env.ADMIN_INITIAL_EMAIL || 'admin@example.com';
      const password = process.env.ADMIN_INITIAL_PASSWORD || 'admin123';
      const passwordHash = await hashPassword(password);
      await db.insert(adminTable).values({
        email,
        passwordHash,
      });
      console.log(`[Seed] Initialized primary admin account: ${email}`);
    }
  } catch (err) {
    console.warn('[Seed] Could not check or seed admin user:', err);
  }
}

// Allow direct CLI execution: node dist/seed.js
if (typeof require !== 'undefined' && require.main === module) {
  seedInitialAdmin().catch(console.error);
}
