import { db } from './db';
import { adminTable } from './db/schema';
import { hashPassword } from './services/auth.service';

async function seed() {
  const existing = await db.select().from(adminTable).limit(1);
  if (existing.length === 0) {
    const passwordHash = await hashPassword('admin123'); // Default password
    await db.insert(adminTable).values({
      email: 'admin@example.com', // Change this
      passwordHash,
    });
    console.log('Created default admin user: admin@example.com / admin123');
  } else {
    console.log('Admin user already exists');
  }
}

seed().catch(console.error);
