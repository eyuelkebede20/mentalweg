import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { sessionsTable, clientsTable, paymentsTable } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { getSettings } from '../services/settings.service';
import { createHold } from '../services/hold.service';
import { verifyReceipt } from '../services/verifier.service';
import { getAvailableSlots } from '../services/slot.service';
import { sanitizeText, sanitizeEmail, normalizeEthiopianPhone } from '../utils/sanitize';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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
          if (buffer.length <= 5 * 1024 * 1024) { // max 5MB
            const uploadsDir = path.join(process.cwd(), 'uploads');
            if (!fs.existsSync(uploadsDir)) {
              fs.mkdirSync(uploadsDir, { recursive: true });
            }
            const filename = `receipt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
            fs.writeFileSync(path.join(uploadsDir, filename), buffer);
            screenshotPath = `/uploads/${filename}`;
          }
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
}
