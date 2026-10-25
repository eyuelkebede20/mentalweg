import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { sessionsTable, clientsTable, paymentsTable, postsTable, materialsTable, sessionChangesTable } from '../db/schema';
import { eq, and, desc, sql, gte, isNull, inArray } from 'drizzle-orm';
import { getSettings } from '../services/settings.service';
import { createHold } from '../services/hold.service';
import { verifyReceipt } from '../services/verifier.service';
import { getAvailableSlots } from '../services/slot.service';
import { sanitizeText, sanitizeEmail, normalizeEthiopianPhone } from '../utils/sanitize';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getUploadsDir } from '../utils/paths';

export async function publicRoutes(app: FastifyInstance) {
  
  // Public practice config for landing page & booking
  app.get('/api/public/config', async () => {
    const settings = await getSettings();
    return {
      practiceName: settings.practiceName,
      iconUrl: settings.iconUrl,
      quote: settings.quote,
      quoteAuthor: settings.quoteAuthor,
      bio: settings.bio,
      locationText: settings.locationText,
      accentColor: settings.accentColor,
      shiftStart: settings.shiftStart,
      shiftEnd: settings.shiftEnd,
      hourlyRateEtb: settings.hourlyRateEtb,
      schedulingFeePercent: settings.schedulingFeePercent,
      feeEtb: Math.round(settings.hourlyRateEtb * (settings.schedulingFeePercent / 100)),
      trainingPosters: settings.trainingPosters || [],
      paymentAccounts: (settings.paymentAccounts || []).filter(a => a.active),
      rescheduleLeadTimeDays: settings.rescheduleLeadTimeDays ?? 7,
      rescheduleWindowWeeks: settings.rescheduleWindowWeeks ?? 4,
      allowClientCancellation: settings.allowClientCancellation ?? false,
      cancellationPolicyText: settings.cancellationPolicyText || 'Appointments cannot be rescheduled or cancelled within 7 days of the scheduled time. For urgent adjustments, please contact the practice directly.',
    };
  });

  // Get available 1-hour slots
  app.get('/api/public/slots', async (req, reply) => {
    const querySchema = z.object({
      from: z.string(),
      to: z.string(),
      duration: z.coerce.number().default(60)
    });

    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.status(400).send(parsed.error);

    const { from, to, duration } = parsed.data;
    const slots = await getAvailableSlots(new Date(from), new Date(to), duration);
    return slots;
  });

  // Book a session with payment proof & sanitized details
  app.post('/api/public/booking', async (req, reply) => {
    const schema = z.object({
      clientName: z.string().min(1, 'Name is required').max(100),
      clientPhone: z.string().min(1, 'Phone is required').max(30),
      clientEmail: z.string().optional(),
      startUtc: z.string().min(1, 'Start time is required'),
      provider: z.string().min(1, 'Payment provider is required'),
      reference: z.string().min(1, 'Payment reference is required').max(100),
      screenshotBase64: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message || 'Invalid input' });
    }

    const { clientName, clientPhone, clientEmail, startUtc, provider, reference, screenshotBase64 } = parsed.data;

    // 1. Sanitize text and normalize phone
    const cleanName = sanitizeText(clientName);
    const cleanReference = sanitizeText(reference);
    const cleanEmail = sanitizeEmail(clientEmail);
    let normalizedPhone: string;
    try {
      normalizedPhone = normalizeEthiopianPhone(clientPhone);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Invalid Ethiopian phone number' });
    }

    if (!cleanName) {
      return reply.status(400).send({ error: 'Please provide a valid name.' });
    }
    if (!cleanReference) {
      return reply.status(400).send({ error: 'Please provide a valid payment reference.' });
    }

    // 2. Replay protection
    const existingPayments = db.select().from(paymentsTable).where(
      and(eq(paymentsTable.provider, provider), eq(paymentsTable.reference, cleanReference))
    ).limit(1).all();

    if (existingPayments.length > 0) {
      return reply.status(400).send({ error: 'This payment reference has already been submitted.' });
    }

    // 3. Handle optional screenshot upload (base64 image)
    let screenshotPath: string | undefined = undefined;
    if (screenshotBase64 && screenshotBase64.startsWith('data:image/')) {
      try {
        const matches = screenshotBase64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (matches) {
          const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          const uploadsDir = getUploadsDir();
          const filename = `receipt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
          fs.writeFileSync(path.join(uploadsDir, filename), buffer);
          screenshotPath = `/uploads/${filename}`;
        }
      } catch (err) {
        console.error('Failed to save receipt image:', err);
      }
    }

    // 4. Create Hold & Client
    const startDate = new Date(startUtc);
    let holdResult;
    try {
      holdResult = await createHold({
        displayName: cleanName,
        phoneE164: normalizedPhone,
        email: cleanEmail,
        startUtc: startDate,
        durationMin: 60, // Exactly 1 hour as requested
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'The chosen slot is no longer available.' });
    }

    const { client, session } = holdResult;
    const settings = await getSettings();
    const expectedCents = session.feeDueCents;

    const currentAccount = (settings.paymentAccounts || []).find(a => a.provider.toLowerCase() === provider.toLowerCase());
    const accountDigits = currentAccount?.accountNumber ? currentAccount.accountNumber.replace(/\D/g, '') : '';
    const suffix = provider.toLowerCase() === 'cbe' ? accountDigits.slice(-8) : accountDigits.slice(-5);

    // 5. Verify payment through verifier service
    let verifyRes: any = { verified: false, amountCents: 0 };
    try {
      verifyRes = await verifyReceipt(provider, cleanReference, {
        screenshotPath,
        suffix: suffix || undefined,
        phoneNumber: normalizedPhone,
        receiverAccount: currentAccount?.accountNumber,
        receiverName: currentAccount?.holderName
      });
    } catch (e) {
      // If verifier fails or network timeout, treat as unverified for manual review
      verifyRes = { verified: false, amountCents: 0 };
    }

    let finalStatus = 'awaiting_payment';
    let isPaymentVerified = false;

    if (verifyRes.verified && verifyRes.amountCents !== undefined && verifyRes.amountCents >= expectedCents) {
      finalStatus = 'confirmed';
      isPaymentVerified = true;
    } else {
      // Flag for manual review / receipt inspection by admin
      finalStatus = 'needs_review';
    }

    // 6. Record payment in database
    const [payment] = db.insert(paymentsTable).values({
      sessionId: session.id,
      provider,
      reference: cleanReference,
      amountCents: verifyRes.amountCents || expectedCents,
      verified: isPaymentVerified,
      method: isPaymentVerified ? 'auto' : 'manual',
      screenshotPath: screenshotPath,
    }).returning().all();

    // 7. Update session status
    db.update(sessionsTable)
      .set({
        status: finalStatus,
        holdExpiresAt: finalStatus === 'confirmed' ? null : session.holdExpiresAt,
      })
      .where(eq(sessionsTable.id, session.id))
      .run();

    return {
      success: true,
      sessionId: session.id,
      status: finalStatus,
      clientPublicId: client.publicId,
      message: finalStatus === 'confirmed' 
        ? 'Your booking is confirmed!' 
        : 'Your booking proof has been submitted and is pending verification.',
      paymentId: payment.id,
      slotStartUtc: session.startUtc,
    };
  });

  // Public Blog Articles
  app.get('/api/public/posts', async () => {
    return db.select().from(postsTable)
      .where(eq(postsTable.published, true))
      .orderBy(desc(postsTable.createdAt))
      .all();
  });

  app.get('/api/public/posts/:slug', async (req, reply) => {
    const paramsSchema = z.object({ slug: z.string() });
    const params = paramsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid slug' });

    const [post] = db.select().from(postsTable)
      .where(and(eq(postsTable.slug, params.data.slug), eq(postsTable.published, true)))
      .all();

    if (!post) return reply.status(404).send({ error: 'Article not found' });
    return post;
  });

  // Public Clinical Materials & Documents
  app.get('/api/public/materials', async () => {
    return db.select().from(materialsTable)
      .where(eq(materialsTable.published, true))
      .orderBy(desc(materialsTable.createdAt))
      .all();
  });

  app.post('/api/public/materials/:id/download', async (req, reply) => {
    const paramsSchema = z.object({ id: z.coerce.number().int() });
    const params = paramsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid ID' });

    const [material] = db.select().from(materialsTable).where(eq(materialsTable.id, params.data.id)).all();
    if (!material) return reply.status(404).send({ error: 'Material not found' });

    db.update(materialsTable)
      .set({ downloadCount: sql`${materialsTable.downloadCount} + 1` })
      .where(eq(materialsTable.id, params.data.id))
      .run();

    return {
      success: true,
      fileUrl: material.fileUrl,
      fileName: material.fileName,
      downloadCount: material.downloadCount + 1,
    };
  });

  // --- VERIFIED CLIENT PORTAL & RESCHEDULING API ---

  // 1. Get verified client profile and upcoming sessions with cancellation/reschedule eligibility
  app.get('/api/m/:token', async (req, reply) => {
    const paramsSchema = z.object({ token: z.string().min(1) });
    const params = paramsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid token' });

    const client = db.select().from(clientsTable).where(
      and(
        eq(clientsTable.bookingToken, params.data.token),
        eq(clientsTable.isVerified, true),
        isNull(clientsTable.deletedAt)
      )
    ).all()[0];

    if (!client) {
      return reply.status(404).send({ error: 'Verified access link not found or invalid.' });
    }

    const settings = await getSettings();
    const now = new Date();

    // Fetch upcoming sessions for this client (excluding expired or cancelled)
    const upcomingSessions = db.select().from(sessionsTable).where(
      and(
        eq(sessionsTable.clientId, client.id),
        gte(sessionsTable.startUtc, now),
        inArray(sessionsTable.status, ['confirmed', 'held', 'needs_review', 'awaiting_payment'])
      )
    ).all().sort((a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime());

    const leadTimeDays = settings.rescheduleLeadTimeDays ?? 7;
    const windowWeeks = settings.rescheduleWindowWeeks ?? 4;
    const allowCancel = settings.allowClientCancellation ?? false;

    const evaluatedSessions = upcomingSessions.map(s => {
      const sessionStart = new Date(s.startUtc);
      const diffMs = sessionStart.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      const canReschedule = diffDays >= leadTimeDays;
      const canCancel = allowCancel && canReschedule;

      return {
        id: s.id,
        startUtc: s.startUtc,
        durationMin: s.durationMin,
        status: s.status,
        feeDueCents: s.feeDueCents,
        feeWaived: s.feeWaived,
        daysUntilSession: Math.max(0, Math.floor(diffDays)),
        canReschedule,
        canCancel,
        lockReason: !canReschedule 
          ? `Changes locked within ${leadTimeDays} days of appointment` 
          : null,
      };
    });

    return {
      client: {
        id: client.id,
        publicId: client.publicId,
        displayName: client.displayName,
        phoneE164: client.phoneE164,
        email: client.email,
        isVerified: client.isVerified,
      },
      policy: {
        rescheduleLeadTimeDays: leadTimeDays,
        rescheduleWindowWeeks: windowWeeks,
        allowClientCancellation: allowCancel,
        cancellationPolicyText: settings.cancellationPolicyText,
      },
      practice: {
        practiceName: settings.practiceName,
        locationText: settings.locationText,
        bio: settings.bio,
      },
      sessions: evaluatedSessions,
    };
  });

  // 2. Get available slots for verified client rescheduling (horizon: settings.rescheduleWindowWeeks)
  app.get('/api/m/:token/slots', async (req, reply) => {
    const paramsSchema = z.object({ token: z.string().min(1) });
    const querySchema = z.object({
      duration: z.coerce.number().default(60),
    });

    const params = paramsSchema.safeParse(req.params);
    const query = querySchema.safeParse(req.query);
    if (!params.success || !query.success) {
      return reply.status(400).send({ error: 'Invalid parameters' });
    }

    const client = db.select().from(clientsTable).where(
      and(
        eq(clientsTable.bookingToken, params.data.token),
        eq(clientsTable.isVerified, true),
        isNull(clientsTable.deletedAt)
      )
    ).all()[0];

    if (!client) {
      return reply.status(404).send({ error: 'Verified access link not found or invalid.' });
    }

    const settings = await getSettings();
    const windowWeeks = settings.rescheduleWindowWeeks ?? 4;
    const fromDate = new Date();
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + (windowWeeks * 7));

    const slots = await getAvailableSlots(fromDate, toDate, query.data.duration);
    return { slots, windowWeeks };
  });

  // 3. Reschedule an appointment
  app.post('/api/m/:token/sessions/:id/reschedule', async (req, reply) => {
    const paramsSchema = z.object({
      token: z.string().min(1),
      id: z.coerce.number().int(),
    });
    const bodySchema = z.object({
      newStartUtc: z.string().min(1),
    });

    const params = paramsSchema.safeParse(req.params);
    const body = bodySchema.safeParse(req.body);

    if (!params.success || !body.success) {
      return reply.status(400).send({ error: 'Invalid reschedule parameters' });
    }

    const client = db.select().from(clientsTable).where(
      and(
        eq(clientsTable.bookingToken, params.data.token),
        eq(clientsTable.isVerified, true),
        isNull(clientsTable.deletedAt)
      )
    ).all()[0];

    if (!client) {
      return reply.status(404).send({ error: 'Verified access link not found or invalid.' });
    }

    const session = db.select().from(sessionsTable).where(
      and(
        eq(sessionsTable.id, params.data.id),
        eq(sessionsTable.clientId, client.id)
      )
    ).all()[0];

    if (!session) {
      return reply.status(404).send({ error: 'Session not found for this client.' });
    }

    if (session.status === 'cancelled') {
      return reply.status(400).send({ error: 'Cancelled sessions cannot be rescheduled.' });
    }

    const settings = await getSettings();
    const leadTimeDays = settings.rescheduleLeadTimeDays ?? 7;
    const now = new Date();
    const sessionStart = new Date(session.startUtc);
    const diffMs = sessionStart.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays < leadTimeDays) {
      return reply.status(400).send({
        error: `Appointments cannot be rescheduled within ${leadTimeDays} days of the scheduled time. Rescheduling is currently locked online. Please contact the practice directly.`,
        locked: true,
        leadTimeDays,
      });
    }

    const newStart = new Date(body.data.newStartUtc);
    if (isNaN(newStart.getTime()) || newStart.getTime() <= now.getTime()) {
      return reply.status(400).send({ error: 'Please choose a valid future appointment time.' });
    }

    const maxHorizonDays = (settings.rescheduleWindowWeeks ?? 4) * 7;
    const maxHorizonDate = new Date();
    maxHorizonDate.setDate(maxHorizonDate.getDate() + maxHorizonDays);
    if (newStart.getTime() > maxHorizonDate.getTime()) {
      return reply.status(400).send({ error: `You can only reschedule within the next ${settings.rescheduleWindowWeeks ?? 4} weeks.` });
    }

    // Verify slot availability with buffer
    const dayStart = new Date(newStart);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(newStart);
    dayEnd.setUTCHours(23, 59, 59, 999);
    const slots = await getAvailableSlots(dayStart, dayEnd, session.durationMin);

    const slotMatches = slots.some(s => Math.abs(new Date(s.startUtc).getTime() - newStart.getTime()) < 60000);
    if (!slotMatches) {
      return reply.status(400).send({
        error: 'The selected slot is unavailable or clashes with operating hours/buffer. Please select another slot.',
      });
    }

    const oldStartUtc = session.startUtc;

    // Execute update in db
    db.update(sessionsTable)
      .set({
        startUtc: newStart,
        status: 'confirmed',
      })
      .where(eq(sessionsTable.id, session.id))
      .run();

    // Log the change in sessionChangesTable with by: 'client'
    db.insert(sessionChangesTable).values({
      sessionId: session.id,
      fromStartUtc: oldStartUtc,
      toStartUtc: newStart,
      by: 'client',
      at: new Date(),
    }).run();

    return {
      success: true,
      message: 'Your appointment has been successfully rescheduled.',
      sessionId: session.id,
      previousStartUtc: oldStartUtc,
      newStartUtc: newStart,
    };
  });

  // 4. Cancel an appointment (if permitted by policy)
  app.post('/api/m/:token/sessions/:id/cancel', async (req, reply) => {
    const paramsSchema = z.object({
      token: z.string().min(1),
      id: z.coerce.number().int(),
    });

    const params = paramsSchema.safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: 'Invalid parameters' });

    const client = db.select().from(clientsTable).where(
      and(
        eq(clientsTable.bookingToken, params.data.token),
        eq(clientsTable.isVerified, true),
        isNull(clientsTable.deletedAt)
      )
    ).all()[0];

    if (!client) {
      return reply.status(404).send({ error: 'Verified access link not found or invalid.' });
    }

    const session = db.select().from(sessionsTable).where(
      and(
        eq(sessionsTable.id, params.data.id),
        eq(sessionsTable.clientId, client.id)
      )
    ).all()[0];

    if (!session) {
      return reply.status(404).send({ error: 'Session not found for this client.' });
    }

    const settings = await getSettings();
    if (!settings.allowClientCancellation) {
      return reply.status(400).send({
        error: 'Online cancellations are disabled by practice policy. Please contact your therapist directly or reschedule to a different slot.',
      });
    }

    const leadTimeDays = settings.rescheduleLeadTimeDays ?? 7;
    const now = new Date();
    const sessionStart = new Date(session.startUtc);
    const diffMs = sessionStart.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays < leadTimeDays) {
      return reply.status(400).send({
        error: `Appointments cannot be cancelled within ${leadTimeDays} days of the scheduled time. Cancellations are currently locked online. Please contact the practice directly.`,
        locked: true,
      });
    }

    db.update(sessionsTable)
      .set({ status: 'cancelled' })
      .where(eq(sessionsTable.id, session.id))
      .run();

    db.insert(sessionChangesTable).values({
      sessionId: session.id,
      fromStartUtc: session.startUtc,
      toStartUtc: session.startUtc,
      by: 'client',
      at: new Date(),
    }).run();

    return {
      success: true,
      message: 'Your appointment has been cancelled.',
    };
  });
}
