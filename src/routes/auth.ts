import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { adminTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword } from '../services/auth.service';
import crypto from 'crypto';

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (req, reply) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    const { email, password } = parsed.data;

    const [admin] = await db.select().from(adminTable).where(eq(adminTable.email, email));
    if (!admin) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const isValid = await verifyPassword(password, admin.passwordHash);
    if (!isValid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    // Set session cookie
    const sessionId = crypto.randomUUID();
    // For simplicity, we sign a simple admin cookie. In a real app we'd use a session store or fastify-secure-session.
    // The requirement says "Sessions last 30 days on the phone".
    // Since there's no session table specified in the schema, we'll use a signed cookie containing the admin id.
    const cookieData = JSON.stringify({ adminId: admin.id, sessionId });

    reply.setCookie('admin_session', cookieData, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      signed: true,
    });

    return { success: true };
  });

  app.post('/auth/logout', async (req, reply) => {
    reply.clearCookie('admin_session', { path: '/' });
    return { success: true };
  });

  app.post('/auth/forgot', async (req, reply) => {
    // TODO: implement reset logic and emailing link
    return { success: true, message: 'If an account exists, a link was sent.' };
  });

  app.post('/auth/reset', async (req, reply) => {
    // TODO: implement reset confirmation
    return { success: true };
  });
}
