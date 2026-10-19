import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { 
  sessionsTable, 
  clientsTable, 
  paymentsTable, 
  pushSubscriptionsTable, 
  blocksTable,
  remindersTable,
  sessionChangesTable,
  seriesTable,
  holidaysTable,
  postsTable,
  materialsTable
} from '../db/schema';
import { eq, and, gte, lt, lte, desc, isNull, sql } from 'drizzle-orm';
import { getSettings, updateSettings } from '../services/settings.service';
import { sanitizeText, sanitizeEmail, normalizeEthiopianPhone } from '../utils/sanitize';
import { sendEmail } from '../services/email.service';
import { seedHolidays } from '../db/seedHolidays';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getUploadsDir } from '../utils/paths';

export async function adminRoutes(app: FastifyInstance) {
  
  // 1. Settings Routes
  app.get('/api/admin/settings', async () => {
    return await getSettings();
  });

  const handleUpdateSettings = async (req: any, reply: any) => {
    try {
      const updated = await updateSettings(req.body as any);
      return updated;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Failed to update settings' });
    }
  };

  app.put('/api/admin/settings', handleUpdateSettings);
  app.patch('/api/admin/settings', handleUpdateSettings);

  // 2. Sessions & Calendar
  app.get('/api/admin/sessions', async (req, reply) => {
    const schema = z.object({
      start: z.string().optional(),
      end: z.string().optional(),
    });

    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return reply.status(400).send(parsed.error);

    const fromDate = parsed.data.start ? new Date(parsed.data.start) : new Date(Date.now() - 30 * 86400000);
    const toDate = parsed.data.end ? new Date(parsed.data.end) : new Date(Date.now() + 60 * 86400000);

    const sessions = db.select({
      session: sessionsTable,
      client: clientsTable,
      payment: paymentsTable,
    })
    .from(sessionsTable)
    .leftJoin(clientsTable, eq(sessionsTable.clientId, clientsTable.id))
    .leftJoin(paymentsTable, eq(sessionsTable.id, paymentsTable.sessionId))
    .where(
      and(
        gte(sessionsTable.startUtc, fromDate),
        lt(sessionsTable.startUtc, toDate)
      )
    )
    .all();

    return sessions.map(({ session, client, payment }) => ({
      id: session.id,
      title: client ? `${client.displayName} (${session.status})` : `Session #${session.id}`,
      start: session.startUtc,
      durationMin: session.durationMin,
      status: session.status,
      source: session.source,
      feeDueCents: session.feeDueCents,
      feeWaived: session.feeWaived,
      clientId: session.clientId,
      clientName: client?.displayName || 'Unknown Client',
      clientPhone: client?.phoneE164 || '',
      clientEmail: client?.email || '',
      isVerified: client?.isVerified || false,
      paymentId: payment?.id,
      paymentProvider: payment?.provider,
      paymentReference: payment?.reference,
      paymentScreenshotPath: payment?.screenshotPath,
      paymentVerified: payment?.verified ?? false,
    }));
  });

  // Self-book / Manual booking (No payment verification needed)
  app.post('/api/admin/sessions/self-book', async (req, reply) => {
    const schema = z.object({
      clientId: z.number().int().optional(),
      clientName: z.string().optional(),
      clientPhone: z.string().optional(),
      clientEmail: z.string().optional(),
      isVerified: z.boolean().optional(),
      startUtc: z.string(),
      durationMin: z.number().int().default(60),
      note: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0]?.message || 'Invalid request' });

    let clientId = parsed.data.clientId;

    // If no clientId, find or create client
    if (!clientId) {
      if (!parsed.data.clientName || !parsed.data.clientPhone) {
        return reply.status(400).send({ error: 'Client Name and Phone are required for new bookings' });
      }

      const cleanName = sanitizeText(parsed.data.clientName);
      let normPhone: string;
      try {
        normPhone = normalizeEthiopianPhone(parsed.data.clientPhone);
      } catch (e: any) {
        normPhone = parsed.data.clientPhone.trim();
      }

      let [existingClient] = db.select().from(clientsTable).where(eq(clientsTable.phoneE164, normPhone)).all();
      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const clientsCount = db.select().from(clientsTable).all().length;
        const publicId = `C-${(clientsCount + 1).toString().padStart(4, '0')}`;
        const isVer = !!parsed.data.isVerified;
        const [newClient] = db.insert(clientsTable).values({
          publicId,
          displayName: cleanName,
          phoneE164: normPhone,
          email: sanitizeEmail(parsed.data.clientEmail),
          note: parsed.data.note ? sanitizeText(parsed.data.note) : undefined,
          isVerified: isVer,
          bookingToken: isVer ? crypto.randomBytes(16).toString('hex') : undefined,
        }).returning().all();
        clientId = newClient.id;
      }
    }

    const startDate = new Date(parsed.data.startUtc);
    const [session] = db.insert(sessionsTable).values({
      clientId,
      startUtc: startDate,
      durationMin: parsed.data.durationMin,
      status: 'confirmed', // Self-booked sessions are confirmed immediately
      source: 'manual',
      feeDueCents: 0,
      feeWaived: true, // Bypasses payment verification
      originalStartUtc: startDate,
    }).returning().all();

    const [client] = db.select().from(clientsTable).where(eq(clientsTable.id, clientId)).all();

    return { success: true, session, client };
  });

  // Standard session create (alias to manual booking)
  app.post('/api/admin/sessions', async (req, reply) => {
    const schema = z.object({
      clientId: z.number().int(),
      startUtc: z.string(),
      durationMin: z.number().int().default(60),
      feeWaived: z.boolean().default(true),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error);

    const [session] = db.insert(sessionsTable).values({
      clientId: parsed.data.clientId,
      startUtc: new Date(parsed.data.startUtc),
      durationMin: parsed.data.durationMin,
      status: 'confirmed',
      source: 'manual',
      feeDueCents: 0,
      feeWaived: parsed.data.feeWaived,
      originalStartUtc: new Date(parsed.data.startUtc),
    }).returning().all();

    return session;
  });

  app.patch('/api/admin/sessions/:id', async (req, reply) => {
    const paramsSchema = z.object({ id: z.coerce.number().int() });
    const bodySchema = z.object({
      startUtc: z.string().optional(),
      durationMin: z.number().int().optional(),
      status: z.string().optional(),
    });

    const params = paramsSchema.safeParse(req.params);
    const body = bodySchema.safeParse(req.body);

    if (!params.success || !body.success) return reply.status(400).send('Invalid request');

    const updateData: any = {};
    if (body.data.startUtc) updateData.startUtc = new Date(body.data.startUtc);
    if (body.data.durationMin) updateData.durationMin = body.data.durationMin;
    if (body.data.status) updateData.status = body.data.status;

    const [session] = db.update(sessionsTable)
      .set(updateData)
      .where(eq(sessionsTable.id, params.data.id))
      .returning()
      .all();

    return session;
  });

  // Remove/Cancel allotted time or session
  app.delete('/api/admin/sessions/:id', async (req, reply) => {
    const paramsSchema = z.object({ id: z.coerce.number().int() });
    const params = paramsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send('Invalid request');

    db.update(sessionsTable)
      .set({ status: 'cancelled' })
      .where(eq(sessionsTable.id, params.data.id))
      .run();

    return { success: true };
  });

  // 3. Blocks (Removing/blocking custom time ranges)
  app.get('/api/admin/blocks', async () => {
    return db.select().from(blocksTable).all();
  });

  app.post('/api/admin/blocks', async (req, reply) => {
    const schema = z.object({
      startUtc: z.string(),
      endUtc: z.string(),
      reason: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error);

    const [block] = db.insert(blocksTable).values({
      startUtc: new Date(parsed.data.startUtc),
      endUtc: new Date(parsed.data.endUtc),
      reason: parsed.data.reason ? sanitizeText(parsed.data.reason) : 'Blocked Time',
    }).returning().all();

    return block;
  });

  app.delete('/api/admin/blocks/:id', async (req, reply) => {
    const paramsSchema = z.object({ id: z.coerce.number().int() });
    const params = paramsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send('Invalid request');

    db.delete(blocksTable).where(eq(blocksTable.id, params.data.id)).run();
    return { success: true };
  });

  // 4. Clients
  app.get('/api/admin/clients', async () => {
    const clients = db.select().from(clientsTable).orderBy(desc(clientsTable.id)).all();
    const sessions = db.select().from(sessionsTable).all();
    
    // Count sessions per client
    const sessionCountMap: Record<number, number> = {};
    sessions.forEach(s => {
      sessionCountMap[s.clientId] = (sessionCountMap[s.clientId] || 0) + 1;
    });

    return clients.map(c => ({
      ...c,
      totalSessions: sessionCountMap[c.id] || 0,
    }));
  });

  app.post('/api/admin/clients', async (req, reply) => {
    const schema = z.object({
      displayName: z.string().min(1),
      phoneE164: z.string().min(1),
      email: z.string().optional(),
      note: z.string().optional(),
      isVerified: z.boolean().default(false),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error);

    const clientsCount = db.select().from(clientsTable).all().length;
    const publicId = `C-${(clientsCount + 1).toString().padStart(4, '0')}`;

    let normPhone: string;
    try {
      normPhone = normalizeEthiopianPhone(parsed.data.phoneE164);
    } catch {
      normPhone = parsed.data.phoneE164.trim();
    }

    const [existing] = db.select().from(clientsTable).where(eq(clientsTable.phoneE164, normPhone)).all();
    if (existing) {
      return reply.status(409).send({
        error: `A client with phone ${normPhone} is already registered (${existing.displayName}, ${existing.publicId}).`,
        client: existing,
      });
    }

    const [client] = db.insert(clientsTable).values({
      publicId,
      displayName: sanitizeText(parsed.data.displayName),
      phoneE164: normPhone,
      email: sanitizeEmail(parsed.data.email),
      note: parsed.data.note ? sanitizeText(parsed.data.note) : undefined,
      isVerified: parsed.data.isVerified,
      bookingToken: parsed.data.isVerified ? crypto.randomBytes(16).toString('hex') : undefined,
    }).returning().all();

    return client;
  });

  app.patch('/api/admin/clients/:id', async (req, reply) => {
    const paramsSchema = z.object({ id: z.coerce.number().int() });
    const bodySchema = z.object({
      displayName: z.string().optional(),
      phoneE164: z.string().optional(),
      email: z.string().optional(),
      isVerified: z.boolean().optional(),
      note: z.string().optional()
    });

    const params = paramsSchema.safeParse(req.params);
    const body = bodySchema.safeParse(req.body);
    if (!params.success || !body.success) return reply.status(400).send('Invalid');

    const updateData: any = {};
    if (body.data.displayName) updateData.displayName = sanitizeText(body.data.displayName);
    if (body.data.phoneE164) {
      try {
        updateData.phoneE164 = normalizeEthiopianPhone(body.data.phoneE164);
      } catch {
        updateData.phoneE164 = body.data.phoneE164.trim();
      }
    }
    if (body.data.email !== undefined) updateData.email = sanitizeEmail(body.data.email);
    if (body.data.isVerified !== undefined) {
      updateData.isVerified = body.data.isVerified;
      if (body.data.isVerified) {
        // If client doesn't have a booking token, generate one
        const [existing] = db.select().from(clientsTable).where(eq(clientsTable.id, params.data.id)).all();
        if (existing && !existing.bookingToken) {
          updateData.bookingToken = crypto.randomBytes(16).toString('hex');
        }
      }
    }
    if (body.data.note !== undefined) updateData.note = sanitizeText(body.data.note);

    const [client] = db.update(clientsTable)
      .set(updateData)
      .where(eq(clientsTable.id, params.data.id))
      .returning()
      .all();

    return client;
  });

  // 5. Payments
  app.get('/api/admin/payments/pending', async () => {
    const pending = db.select({
      payment: paymentsTable,
      session: sessionsTable,
      client: clientsTable
    })
    .from(paymentsTable)
    .leftJoin(sessionsTable, eq(paymentsTable.sessionId, sessionsTable.id))
    .leftJoin(clientsTable, eq(sessionsTable.clientId, clientsTable.id))
    .where(eq(paymentsTable.verified, false))
    .all();

    return pending.map(p => ({
      id: p.payment.id,
      provider: p.payment.provider,
      reference: p.payment.reference,
      amountCents: p.payment.amountCents,
      screenshotPath: p.payment.screenshotPath,
      paidAt: p.payment.paidAt,
      session: p.session,
      client: p.client
    }));
  });

  app.post('/api/admin/payments/:id/confirm', async (req, reply) => {
    const paramsSchema = z.object({ id: z.coerce.number().int() });
    const params = paramsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send('Invalid request');

    const paymentId = params.data.id;
    const [payment] = db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId)).all();
    if (!payment) return reply.status(404).send('Payment not found');

    db.update(paymentsTable)
      .set({ verified: true, method: 'manual', paidAt: payment.paidAt || new Date() })
      .where(eq(paymentsTable.id, paymentId))
      .run();

    if (payment.sessionId) {
      db.update(sessionsTable)
        .set({ status: 'confirmed', holdExpiresAt: null })
        .where(eq(sessionsTable.id, payment.sessionId))
        .run();
    }

    return { success: true };
  });

  app.get('/api/admin/money', async () => {
    const verifiedPayments = db.select({
      payment: paymentsTable,
      client: clientsTable
    })
    .from(paymentsTable)
    .leftJoin(sessionsTable, eq(paymentsTable.sessionId, sessionsTable.id))
    .leftJoin(clientsTable, eq(sessionsTable.clientId, clientsTable.id))
    .where(eq(paymentsTable.verified, true))
    .all();

    return verifiedPayments.map(p => ({
      id: p.payment.id,
      provider: p.payment.provider,
      reference: p.payment.reference,
      amountCents: p.payment.amountCents,
      method: p.payment.method,
      paidAt: p.payment.paidAt,
      clientName: p.client?.displayName || 'Unknown'
    }));
  });

  // 6. Image Uploads (for poster images, icons, etc.)
  app.post('/api/admin/upload', async (req, reply) => {
    const schema = z.object({
      imageBase64: z.string(),
      fileName: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Image base64 data is required' });

    const { imageBase64, fileName } = parsed.data;
    try {
      const matches = imageBase64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
      if (!matches) {
        return reply.status(400).send({ error: 'Invalid image format. Expected data URI' });
      }

      const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      const uploadsDir = getUploadsDir();

      const cleanBase = fileName ? fileName.replace(/[^a-zA-Z0-9_-]/g, '') : 'img';
      const fileTarget = `${cleanBase}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.${ext}`;
      fs.writeFileSync(path.join(uploadsDir, fileTarget), buffer);

      return { url: `/uploads/${fileTarget}` };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Upload failed' });
    }
  });

  // 7. Push notification subscribe
  app.post('/api/admin/push/subscribe', async (req, reply) => {
    const schema = z.object({
      endpoint: z.string(),
      keys: z.any()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send('Invalid');

    db.insert(pushSubscriptionsTable).values({
      endpoint: parsed.data.endpoint,
      keysJson: JSON.stringify(parsed.data.keys)
    }).run();

    return { success: true };
  });

  // 8. Today Screen & Dashboard Data
  app.get('/api/admin/today', async () => {
    const nowUtc = new Date();
    // Addis Ababa is UTC+3
    const eatOffsetMs = 3 * 60 * 60 * 1000;
    const eatNow = new Date(nowUtc.getTime() + eatOffsetMs);
    const startOfTodayUtc = new Date(Date.UTC(eatNow.getUTCFullYear(), eatNow.getUTCMonth(), eatNow.getUTCDate()) - eatOffsetMs);
    const endOfTodayUtc = new Date(startOfTodayUtc.getTime() + 24 * 60 * 60 * 1000);

    const rawSessions = db.select({
      session: sessionsTable,
      client: clientsTable
    })
    .from(sessionsTable)
    .leftJoin(clientsTable, eq(sessionsTable.clientId, clientsTable.id))
    .where(
      and(
        gte(sessionsTable.startUtc, startOfTodayUtc),
        lt(sessionsTable.startUtc, endOfTodayUtc)
      )
    )
    .all();

    const sessionIds = rawSessions.map(s => s.session.id);
    const sentReminders = sessionIds.length > 0 
      ? db.select().from(remindersTable).all().filter(r => sessionIds.includes(r.sessionId))
      : [];

    const sessions = rawSessions
      .filter(s => s.session.status !== 'cancelled')
      .map(({ session, client }) => {
        const startMs = new Date(session.startUtc).getTime();
        const diffHours = (startMs - nowUtc.getTime()) / (1000 * 60 * 60);
        const isReminderDue = session.status === 'confirmed' && diffHours >= -1 && diffHours <= 4;
        const remindersForThis = sentReminders.filter(r => r.sessionId === session.id);

        return {
          id: session.id,
          startUtc: session.startUtc,
          durationMin: session.durationMin,
          status: session.status,
          source: session.source,
          feeWaived: session.feeWaived,
          client: client ? {
            id: client.id,
            publicId: client.publicId,
            displayName: client.displayName,
            phoneE164: client.phoneE164,
            email: client.email,
            isVerified: client.isVerified,
          } : null,
          isReminderDue,
          remindersSent: remindersForThis.map(r => ({ channel: r.channel, sentAt: r.sentAt })),
        };
      })
      .sort((a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime());

    // Pending payment reviews
    const pendingPayments = db.select({
      payment: paymentsTable,
      session: sessionsTable,
      client: clientsTable,
    })
    .from(paymentsTable)
    .leftJoin(sessionsTable, eq(paymentsTable.sessionId, sessionsTable.id))
    .leftJoin(clientsTable, eq(sessionsTable.clientId, clientsTable.id))
    .where(eq(paymentsTable.verified, false))
    .all()
    .map(p => ({
      id: p.payment.id,
      provider: p.payment.provider,
      reference: p.payment.reference,
      amountCents: p.payment.amountCents,
      screenshotPath: p.payment.screenshotPath,
      paidAt: p.payment.paidAt,
      session: p.session,
      client: p.client,
    }));

    // Unapplied payments (payments where sessionId is null)
    const unappliedPayments = db.select({
      payment: paymentsTable,
    })
    .from(paymentsTable)
    .where(isNull(paymentsTable.sessionId))
    .all()
    .map(p => ({
      id: p.payment.id,
      provider: p.payment.provider,
      reference: p.payment.reference,
      amountCents: p.payment.amountCents,
      paidAt: p.payment.paidAt,
      screenshotPath: p.payment.screenshotPath,
    }));

    // Recent reschedules / changes
    const recentChanges = db.select({
      change: sessionChangesTable,
      session: sessionsTable,
      client: clientsTable,
    })
    .from(sessionChangesTable)
    .leftJoin(sessionsTable, eq(sessionChangesTable.sessionId, sessionsTable.id))
    .leftJoin(clientsTable, eq(sessionsTable.clientId, clientsTable.id))
    .orderBy(desc(sessionChangesTable.at))
    .all()
    .slice(0, 10)
    .map(c => ({
      id: c.change.id,
      sessionId: c.change.sessionId,
      fromStartUtc: c.change.fromStartUtc,
      toStartUtc: c.change.toStartUtc,
      by: c.change.by,
      at: c.change.at,
      clientName: c.client?.displayName || 'Client',
      clientPhone: c.client?.phoneE164 || '',
    }));

    return {
      dateEAT: eatNow.toISOString().slice(0, 10),
      sessions,
      pendingPayments,
      unappliedPayments,
      recentChanges,
      stats: {
        totalToday: sessions.length,
        confirmedToday: sessions.filter(s => s.status === 'confirmed').length,
        attendedToday: sessions.filter(s => s.status === 'attended').length,
        pendingReviewsCount: pendingPayments.length,
      }
    };
  });

  // 9. Session Attendance Status Update
  app.post('/api/admin/sessions/:id/attendance', async (req, reply) => {
    const paramsSchema = z.object({ id: z.coerce.number().int() });
    const bodySchema = z.object({ status: z.enum(['attended', 'no_show', 'confirmed', 'cancelled']) });

    const params = paramsSchema.safeParse(req.params);
    const body = bodySchema.safeParse(req.body);

    if (!params.success || !body.success) return reply.status(400).send({ error: 'Invalid status update parameters' });

    const [updated] = db.update(sessionsTable)
      .set({
        status: body.data.status,
        ...(body.data.status === 'confirmed' ? { holdExpiresAt: null } : {})
      })
      .where(eq(sessionsTable.id, params.data.id))
      .returning()
      .all();

    if (body.data.status === 'confirmed') {
      db.update(paymentsTable)
        .set({ verified: true, method: 'manual', paidAt: new Date() })
        .where(eq(paymentsTable.sessionId, params.data.id))
        .run();
    }

    return { success: true, session: updated };
  });

  // 10. Client 4-hour Reminder Trigger (Email or SMS)
  app.post('/api/admin/sessions/:id/notify', async (req, reply) => {
    const paramsSchema = z.object({ id: z.coerce.number().int() });
    const bodySchema = z.object({ channel: z.enum(['email', 'sms']) });

    const params = paramsSchema.safeParse(req.params);
    const body = bodySchema.safeParse(req.body);

    if (!params.success || !body.success) {
      return reply.status(400).send({ error: 'Invalid notification parameters' });
    }

    const [row] = db.select({
      session: sessionsTable,
      client: clientsTable,
    })
    .from(sessionsTable)
    .leftJoin(clientsTable, eq(sessionsTable.clientId, clientsTable.id))
    .where(eq(sessionsTable.id, params.data.id))
    .all();

    if (!row || !row.session || !row.client) {
      return reply.status(404).send({ error: 'Session or client not found' });
    }

    const { session, client } = row;
    const settings = await getSettings();
    const practiceName = settings.practiceName || 'Mentalweg Practice';
    const location = settings.locationText || 'Bulgaria area, near African Union, Addis Ababa';

    const sessionDate = new Date(session.startUtc);
    const timeStr = sessionDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Africa/Addis_Ababa',
    });
    const dateStr = sessionDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      timeZone: 'Africa/Addis_Ababa',
    });

    if (body.data.channel === 'email') {
      if (!client.email) {
        return reply.status(400).send({ error: 'Client does not have an email address recorded.' });
      }

      const emailSubject = `Appointment Reminder - ${dateStr} at ${timeStr}`;
      const emailBody = `Dear ${client.displayName},\n\nThis is a neutral reminder of your scheduled appointment on ${dateStr} at ${timeStr}.\n\nLocation: ${location}\n\nIf you have any questions or require directions upon arrival, please contact the practice.\n\nWarm regards,\n${practiceName}`;

      const delivered = await sendEmail({
        to: client.email,
        subject: emailSubject,
        text: emailBody,
      });

      db.insert(remindersTable).values({
        sessionId: session.id,
        dueAt: session.startUtc,
        sentAt: new Date(),
        channel: 'email',
      }).run();

      return {
        success: true,
        channel: 'email',
        delivered,
        message: delivered ? `Reminder email sent to ${client.email}` : `Simulated reminder logged for ${client.email}`,
      };
    }

    if (body.data.channel === 'sms') {
      const smsText = `Hello ${client.displayName}, this is a reminder for your appointment today at ${timeStr}. Location: ${location}. Please contact us if you need directions.`;
      const cleanPhone = client.phoneE164.replace(/\s+/g, '');
      const smsUrl = `sms:${cleanPhone}?&body=${encodeURIComponent(smsText)}`;

      db.insert(remindersTable).values({
        sessionId: session.id,
        dueAt: session.startUtc,
        sentAt: new Date(),
        channel: 'sms',
      }).run();

      return {
        success: true,
        channel: 'sms',
        smsUrl,
        body: smsText,
        phone: cleanPhone,
      };
    }
  });

  // 11. Client Detail View (History, Sessions, Payments)
  app.get('/api/admin/clients/:id', async (req, reply) => {
    const paramsSchema = z.object({ id: z.coerce.number().int() });
    const params = paramsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid client ID' });

    const [client] = db.select().from(clientsTable).where(eq(clientsTable.id, params.data.id)).all();
    if (!client) return reply.status(404).send({ error: 'Client not found' });

    const sessions = db.select().from(sessionsTable)
      .where(eq(sessionsTable.clientId, client.id))
      .orderBy(desc(sessionsTable.startUtc))
      .all();

    const payments = db.select({
      payment: paymentsTable,
    })
    .from(paymentsTable)
    .leftJoin(sessionsTable, eq(paymentsTable.sessionId, sessionsTable.id))
    .where(eq(sessionsTable.clientId, client.id))
    .all()
    .map(p => p.payment);

    const sessionIds = sessions.map(s => s.id);
    const changes = sessionIds.length > 0
      ? db.select().from(sessionChangesTable).all().filter(c => sessionIds.includes(c.sessionId))
      : [];

    return {
      ...client,
      sessions,
      payments,
      changes,
    };
  });

  // 12. Client Delete & Anonymization
  app.delete('/api/admin/clients/:id', async (req, reply) => {
    const paramsSchema = z.object({ id: z.coerce.number().int() });
    const params = paramsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid client ID' });

    db.update(clientsTable)
      .set({
        displayName: 'Deleted Client',
        phoneE164: `DELETED_${params.data.id}_${Date.now()}`,
        email: null,
        note: null,
        guardianName: null,
        bookingToken: null,
        deletedAt: new Date(),
      })
      .where(eq(clientsTable.id, params.data.id))
      .run();

    return { success: true, message: 'Client anonymized and deleted' };
  });

  // 13. Money Dashboard Analytics
  app.get('/api/admin/money/dashboard', async () => {
    const payments = db.select({
      payment: paymentsTable,
      client: clientsTable,
    })
    .from(paymentsTable)
    .leftJoin(sessionsTable, eq(paymentsTable.sessionId, sessionsTable.id))
    .leftJoin(clientsTable, eq(sessionsTable.clientId, clientsTable.id))
    .where(eq(paymentsTable.verified, true))
    .orderBy(desc(paymentsTable.paidAt))
    .all();

    const now = new Date();
    const eatOffsetMs = 3 * 60 * 60 * 1000;
    const eatNow = new Date(now.getTime() + eatOffsetMs);
    const startOfTodayUtc = new Date(Date.UTC(eatNow.getUTCFullYear(), eatNow.getUTCMonth(), eatNow.getUTCDate()) - eatOffsetMs);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const startOfMonth = new Date(Date.UTC(eatNow.getUTCFullYear(), eatNow.getUTCMonth(), 1) - eatOffsetMs);

    let totalCents = 0;
    let todayCents = 0;
    let weekCents = 0;
    let monthCents = 0;
    const providerMap: Record<string, { totalCents: number; count: number }> = {};
    const dailyMap: Record<string, { amountCents: number; count: number }> = {};

    payments.forEach(({ payment }) => {
      const amount = payment.amountCents;
      totalCents += amount;

      let paidDate = new Date();
      if (payment.paidAt) {
        const d = new Date(payment.paidAt);
        if (!isNaN(d.getTime())) paidDate = d;
      } else if (payment.createdAt) {
        const d = new Date(payment.createdAt);
        if (!isNaN(d.getTime())) paidDate = d;
      }

      if (paidDate >= startOfTodayUtc) todayCents += amount;
      if (paidDate >= sevenDaysAgo) weekCents += amount;
      if (paidDate >= startOfMonth) monthCents += amount;

      if (!providerMap[payment.provider]) {
        providerMap[payment.provider] = { totalCents: 0, count: 0 };
      }
      providerMap[payment.provider].totalCents += amount;
      providerMap[payment.provider].count += 1;

      const dayKey = paidDate.toISOString().slice(0, 10);
      if (!dailyMap[dayKey]) {
        dailyMap[dayKey] = { amountCents: 0, count: 0 };
      }
      dailyMap[dayKey].amountCents += amount;
      dailyMap[dayKey].count += 1;
    });

    return {
      totals: {
        todayCents,
        weekCents,
        monthCents,
        totalCents,
        count: payments.length,
      },
      providerBreakdown: providerMap,
      dailySeries: Object.entries(dailyMap).map(([date, data]) => ({
        date,
        amountEtb: data.amountCents / 100,
        count: data.count,
      })).sort((a, b) => a.date.localeCompare(b.date)),
      payments: payments.map(p => ({
        id: p.payment.id,
        provider: p.payment.provider,
        reference: p.payment.reference,
        amountCents: p.payment.amountCents,
        method: p.payment.method,
        paidAt: p.payment.paidAt,
        clientName: p.client?.displayName || 'Unknown Client',
        clientPublicId: p.client?.publicId || '-',
      }))
    };
  });

  // 14. Recurring Weekly Series Creation
  app.post('/api/admin/series', async (req, reply) => {
    const schema = z.object({
      clientId: z.number().int(),
      weekday: z.number().int().min(0).max(6),
      startLocalTime: z.string(),
      durationMin: z.number().int().default(60),
      startsOn: z.string(),
      endsOn: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid series configuration' });

    const [series] = db.insert(seriesTable).values({
      clientId: parsed.data.clientId,
      weekday: parsed.data.weekday,
      startLocalTime: parsed.data.startLocalTime,
      durationMin: parsed.data.durationMin,
      startsOn: parsed.data.startsOn,
      endsOn: parsed.data.endsOn,
      active: true,
    }).returning().all();

    const startDate = new Date(parsed.data.startsOn);
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 30);
    const endDate = parsed.data.endsOn ? new Date(parsed.data.endsOn) : horizon;
    const finalEnd = endDate < horizon ? endDate : horizon;

    const [timeH, timeM] = parsed.data.startLocalTime.split(':').map(Number);
    const cur = new Date(startDate);
    const createdSessions = [];

    while (cur <= finalEnd) {
      if (cur.getDay() === parsed.data.weekday) {
        const year = cur.getFullYear();
        const month = cur.getMonth();
        const date = cur.getDate();
        const sessionUtc = new Date(Date.UTC(year, month, date, timeH - 3, timeM, 0));

        if (sessionUtc > new Date()) {
          const [s] = db.insert(sessionsTable).values({
            clientId: parsed.data.clientId,
            seriesId: series.id,
            startUtc: sessionUtc,
            durationMin: parsed.data.durationMin,
            status: 'confirmed',
            source: 'series',
            feeDueCents: 0,
            feeWaived: true,
            originalStartUtc: sessionUtc,
          }).returning().all();
          createdSessions.push(s);
        }
      }
      cur.setDate(cur.getDate() + 1);
    }

    return { success: true, series, materializedCount: createdSessions.length };
  });

  // 15. Holidays Management
  app.get('/api/admin/holidays', async () => {
    return db.select().from(holidaysTable).all();
  });

  app.post('/api/admin/holidays/seed', async () => {
    await seedHolidays();
    return db.select().from(holidaysTable).all();
  });

  app.post('/api/admin/holidays/preload', async () => {
    await seedHolidays();
    const holis = db.select().from(holidaysTable).all();
    return { holidays: holis };
  });

  app.post('/api/admin/holidays', async (req, reply) => {
    const schema = z.object({
      date: z.string(),
      name: z.string().min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid holiday' });

    const [h] = db.insert(holidaysTable).values({
      date: parsed.data.date,
      name: sanitizeText(parsed.data.name),
      active: true,
    }).returning().all();
    return h;
  });

  app.delete('/api/admin/holidays/:id', async (req, reply) => {
    const paramsSchema = z.object({ id: z.coerce.number().int() });
    const params = paramsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid ID' });
    db.delete(holidaysTable).where(eq(holidaysTable.id, params.data.id)).run();
    return { success: true };
  });

  // 16. Universal File & Document Upload
  app.post('/api/admin/upload-file', async (req, reply) => {
    const schema = z.object({
      fileBase64: z.string(),
      fileName: z.string(),
      fileType: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'fileBase64 and fileName are required' });

    const { fileBase64, fileName } = parsed.data;
    try {
      let ext = 'pdf';
      let base64Data = fileBase64;

      const dataUriMatch = fileBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (dataUriMatch) {
        const mime = dataUriMatch[1].toLowerCase();
        base64Data = dataUriMatch[2];
        if (mime.includes('pdf')) ext = 'pdf';
        else if (mime.includes('word') || mime.includes('docx')) ext = 'docx';
        else if (mime.includes('doc')) ext = 'doc';
        else if (mime.includes('png')) ext = 'png';
        else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
        else if (mime.includes('webp')) ext = 'webp';
        else if (mime.includes('text') || mime.includes('plain')) ext = 'txt';
      } else {
        const nameExt = path.extname(fileName).replace('.', '').toLowerCase();
        if (nameExt) ext = nameExt;
      }

      const buffer = Buffer.from(base64Data, 'base64');
      const uploadsDir = getUploadsDir();

      const safeBase = path.basename(fileName, path.extname(fileName)).replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileTarget = `${safeBase}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.${ext}`;
      fs.writeFileSync(path.join(uploadsDir, fileTarget), buffer);

      const sizeKb = buffer.length / 1024;
      const fileSize = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${Math.round(sizeKb)} KB`;

      return {
        url: `/uploads/${fileTarget}`,
        fileName: `${safeBase}.${ext}`,
        fileSize,
        fileType: ext,
      };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'File upload failed' });
    }
  });

  // 17. Blog Posts Management
  app.get('/api/admin/posts', async () => {
    return db.select().from(postsTable).orderBy(desc(postsTable.createdAt)).all();
  });

  app.post('/api/admin/posts', async (req, reply) => {
    const schema = z.object({
      title: z.string().min(1),
      slug: z.string().optional(),
      excerpt: z.string().optional(),
      content: z.string().min(1),
      category: z.string().default('Therapy & Insights'),
      authorName: z.string().default('Dr. Hana Almaz'),
      coverImageUrl: z.string().optional(),
      readTimeMin: z.number().int().default(4),
      published: z.boolean().default(true),
      tags: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Title and content are required' });

    let slug = parsed.data.slug ? parsed.data.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') : '';
    if (!slug) {
      slug = parsed.data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `post-${Date.now()}`;
    }

    // Ensure unique slug
    const existing = db.select().from(postsTable).where(eq(postsTable.slug, slug)).all();
    if (existing.length > 0) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    const [post] = db.insert(postsTable).values({
      title: sanitizeText(parsed.data.title),
      slug,
      excerpt: parsed.data.excerpt ? sanitizeText(parsed.data.excerpt) : null,
      content: parsed.data.content,
      category: sanitizeText(parsed.data.category),
      authorName: sanitizeText(parsed.data.authorName),
      coverImageUrl: parsed.data.coverImageUrl || null,
      readTimeMin: parsed.data.readTimeMin,
      published: parsed.data.published,
      tags: parsed.data.tags ? sanitizeText(parsed.data.tags) : null,
    }).returning().all();

    return post;
  });

  app.put('/api/admin/posts/:id', async (req, reply) => {
    const paramsSchema = z.object({ id: z.coerce.number().int() });
    const params = paramsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid ID' });

    const schema = z.object({
      title: z.string().optional(),
      slug: z.string().optional(),
      excerpt: z.string().optional(),
      content: z.string().optional(),
      category: z.string().optional(),
      authorName: z.string().optional(),
      coverImageUrl: z.string().optional(),
      readTimeMin: z.number().int().optional(),
      published: z.boolean().optional(),
      tags: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid update data' });

    const updates: any = {};
    if (parsed.data.title !== undefined) updates.title = sanitizeText(parsed.data.title);
    if (parsed.data.slug !== undefined) updates.slug = parsed.data.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (parsed.data.excerpt !== undefined) updates.excerpt = sanitizeText(parsed.data.excerpt);
    if (parsed.data.content !== undefined) updates.content = parsed.data.content;
    if (parsed.data.category !== undefined) updates.category = sanitizeText(parsed.data.category);
    if (parsed.data.authorName !== undefined) updates.authorName = sanitizeText(parsed.data.authorName);
    if (parsed.data.coverImageUrl !== undefined) updates.coverImageUrl = parsed.data.coverImageUrl;
    if (parsed.data.readTimeMin !== undefined) updates.readTimeMin = parsed.data.readTimeMin;
    if (parsed.data.published !== undefined) updates.published = parsed.data.published;
    if (parsed.data.tags !== undefined) updates.tags = sanitizeText(parsed.data.tags);

    const [updated] = db.update(postsTable)
      .set(updates)
      .where(eq(postsTable.id, params.data.id))
      .returning()
      .all();

    return updated;
  });

  app.delete('/api/admin/posts/:id', async (req, reply) => {
    const paramsSchema = z.object({ id: z.coerce.number().int() });
    const params = paramsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid ID' });

    db.delete(postsTable).where(eq(postsTable.id, params.data.id)).run();
    return { success: true };
  });

  // 18. Patient Materials & Documents Management
  app.get('/api/admin/materials', async () => {
    return db.select().from(materialsTable).orderBy(desc(materialsTable.createdAt)).all();
  });

  app.post('/api/admin/materials', async (req, reply) => {
    const schema = z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      fileUrl: z.string().min(1),
      fileName: z.string().min(1),
      fileSize: z.string().default('1.0 MB'),
      fileType: z.string().default('pdf'),
      category: z.string().default('Clinical Worksheet'),
      published: z.boolean().default(true),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Title, fileUrl, and fileName are required' });

    const [material] = db.insert(materialsTable).values({
      title: sanitizeText(parsed.data.title),
      description: parsed.data.description ? sanitizeText(parsed.data.description) : null,
      fileUrl: parsed.data.fileUrl,
      fileName: sanitizeText(parsed.data.fileName),
      fileSize: parsed.data.fileSize,
      fileType: parsed.data.fileType.toLowerCase(),
      category: sanitizeText(parsed.data.category),
      published: parsed.data.published,
      downloadCount: 0,
    }).returning().all();

    return material;
  });

  app.put('/api/admin/materials/:id', async (req, reply) => {
    const paramsSchema = z.object({ id: z.coerce.number().int() });
    const params = paramsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid ID' });

    const schema = z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      fileUrl: z.string().optional(),
      fileName: z.string().optional(),
      fileSize: z.string().optional(),
      fileType: z.string().optional(),
      category: z.string().optional(),
      published: z.boolean().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid update data' });

    const updates: any = {};
    if (parsed.data.title !== undefined) updates.title = sanitizeText(parsed.data.title);
    if (parsed.data.description !== undefined) updates.description = sanitizeText(parsed.data.description);
    if (parsed.data.fileUrl !== undefined) updates.fileUrl = parsed.data.fileUrl;
    if (parsed.data.fileName !== undefined) updates.fileName = sanitizeText(parsed.data.fileName);
    if (parsed.data.fileSize !== undefined) updates.fileSize = parsed.data.fileSize;
    if (parsed.data.fileType !== undefined) updates.fileType = parsed.data.fileType.toLowerCase();
    if (parsed.data.category !== undefined) updates.category = sanitizeText(parsed.data.category);
    if (parsed.data.published !== undefined) updates.published = parsed.data.published;

    const [updated] = db.update(materialsTable)
      .set(updates)
      .where(eq(materialsTable.id, params.data.id))
      .returning()
      .all();

    return updated;
  });

  app.delete('/api/admin/materials/:id', async (req, reply) => {
    const paramsSchema = z.object({ id: z.coerce.number().int() });
    const params = paramsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid ID' });

    db.delete(materialsTable).where(eq(materialsTable.id, params.data.id)).run();
    return { success: true };
  });
}
