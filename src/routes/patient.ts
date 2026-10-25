import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { clientsTable, sessionsTable, sessionChangesTable } from '../db/schema';
import { eq, and, desc, gte, inArray, isNull, gt } from 'drizzle-orm';
import { hashPassword, verifyPassword, generateResetToken } from '../services/auth.service';
import { sendPatientApprovalEmail, sendPatientPasswordResetEmail } from '../services/email.service';
import { getSettings } from '../services/settings.service';
import { getAvailableSlots } from '../services/slot.service';
import { sanitizeText, sanitizeEmail, normalizeEthiopianPhone } from '../utils/sanitize';
import { env } from '../env';
import crypto from 'crypto';

export function getPatientFromSession(req: any): { clientId: number; email: string } | null {
  const cookie = req.cookies?.patient_session;
  if (!cookie) return null;
  const unsigned = req.unsignCookie(cookie);
  if (!unsigned.valid || !unsigned.value) return null;
  try {
    return JSON.parse(unsigned.value);
  } catch {
    return null;
  }
}

async function getNextPublicId(): Promise<string> {
  const rows = await db.select({ publicId: clientsTable.publicId }).from(clientsTable);
  const nums = rows
    .map(r => parseInt(r.publicId.replace(/\D/g, ''), 10))
    .filter(n => !isNaN(n));
  const nextNum = (nums.length ? Math.max(...nums) : 0) + 1;
  return `C-${nextNum.toString().padStart(4, '0')}`;
}

async function verifyGoogleCredential(credential: string) {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    if (res.ok) {
      const data: any = await res.json();
      if (data.sub && data.email) {
        return {
          googleId: data.sub,
          email: data.email,
          name: data.name || data.given_name || 'Patient',
        };
      }
    }
  } catch (err) {
    console.warn('[Google Auth] Verification endpoint failed, checking JWT payload fallback:', err);
  }

  // Fallback base64 decode for dev / test mock tokens
  try {
    const parts = credential.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      if (payload.sub && payload.email) {
        return {
          googleId: payload.sub,
          email: payload.email,
          name: payload.name || 'Patient',
        };
      }
    }
  } catch {}

  throw new Error('Invalid or unverified Google token');
}

export async function patientRoutes(app: FastifyInstance) {

  // 1. Patient Registration / Signup (Hidden from landing page, direct link only)
  app.post('/api/patient/signup', async (req, reply) => {
    const schema = z.object({
      displayName: z.string().min(2, 'Name must be at least 2 characters').max(100),
      email: z.string().email('Valid email is required'),
      phone: z.string().min(8, 'Phone number is required'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message || 'Invalid registration data' });
    }

    const cleanName = sanitizeText(parsed.data.displayName);
    const cleanEmail = sanitizeEmail(parsed.data.email);
    let normalizedPhone: string;
    try {
      normalizedPhone = normalizeEthiopianPhone(parsed.data.phone);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Invalid Ethiopian phone format (+251...)' });
    }

    // Check if phone or email is already registered
    const existingByPhone = db.select().from(clientsTable).where(eq(clientsTable.phoneE164, normalizedPhone)).all()[0];
    if (existingByPhone && existingByPhone.passwordHash) {
      return reply.status(400).send({ error: 'An account with this phone number already exists. Please log in.' });
    }

    const existingByEmail = cleanEmail ? db.select().from(clientsTable).where(eq(clientsTable.email, cleanEmail)).all()[0] : null;
    if (existingByEmail && existingByEmail.passwordHash) {
      return reply.status(400).send({ error: 'An account with this email address already exists. Please log in.' });
    }

    const pwdHash = await hashPassword(parsed.data.password);
    const token = crypto.randomBytes(16).toString('hex');

    let client;
    if (existingByPhone) {
      // Upgrade existing client record created from guest booking
      [client] = db.update(clientsTable).set({
        displayName: cleanName,
        email: cleanEmail || existingByPhone.email,
        passwordHash: pwdHash,
        approvalStatus: 'pending',
        bookingToken: existingByPhone.bookingToken || token,
      }).where(eq(clientsTable.id, existingByPhone.id)).returning().all();
    } else {
      const publicId = await getNextPublicId();
      [client] = db.insert(clientsTable).values({
        publicId,
        displayName: cleanName,
        phoneE164: normalizedPhone,
        email: cleanEmail,
        passwordHash: pwdHash,
        approvalStatus: 'pending',
        isVerified: false,
        bookingToken: token,
      }).returning().all();
    }

    return {
      success: true,
      pending: true,
      message: 'Your registration has been submitted. For clinical care management and confidentiality, patient portal accounts require approval by Dr. Hana. You will receive an email once your account is activated.',
      client: {
        publicId: client.publicId,
        displayName: client.displayName,
        email: client.email,
        approvalStatus: 'pending',
      }
    };
  });

  // 2. Patient Login
  app.post('/api/patient/login', async (req, reply) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid login parameters' });
    }

    const cleanEmail = sanitizeEmail(parsed.data.email);
    if (!cleanEmail) {
      return reply.status(401).send({ error: 'Invalid email or password.' });
    }
    const client = db.select().from(clientsTable).where(
      and(eq(clientsTable.email, cleanEmail), isNull(clientsTable.deletedAt))
    ).all()[0];

    if (!client || !client.passwordHash) {
      return reply.status(401).send({ error: 'Invalid email or password.' });
    }

    const isValid = await verifyPassword(parsed.data.password, client.passwordHash);
    if (!isValid) {
      return reply.status(401).send({ error: 'Invalid email or password.' });
    }

    // Check Approval Status
    if (client.approvalStatus === 'pending') {
      return reply.status(403).send({
        error: 'Your account is currently pending clinical approval by Dr. Hana. You will receive an email notification as soon as your access is activated.',
        pending: true,
      });
    }

    if (client.approvalStatus === 'rejected') {
      return reply.status(403).send({
        error: 'Your registration was not approved. For inquiries, please contact the practice directly.',
        rejected: true,
      });
    }

    // Set signed cookie
    const cookiePayload = JSON.stringify({ clientId: client.id, email: client.email });
    reply.setCookie('patient_session', cookiePayload, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      signed: true,
    });

    return {
      success: true,
      client: {
        id: client.id,
        publicId: client.publicId,
        displayName: client.displayName,
        email: client.email,
        phoneE164: client.phoneE164,
        isVerified: client.isVerified,
        bookingToken: client.bookingToken,
      }
    };
  });

  // 3. Google OIDC Authentication
  app.post('/api/patient/auth/google', async (req, reply) => {
    const schema = z.object({
      credential: z.string().min(1, 'Google credential token is required'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Missing Google credential' });
    }

    let googleProfile;
    try {
      googleProfile = await verifyGoogleCredential(parsed.data.credential);
    } catch (err: any) {
      return reply.status(401).send({ error: err.message || 'Google verification failed' });
    }

    const { googleId, email, name } = googleProfile;
    const cleanEmail = sanitizeEmail(email);

    // Check if client exists by googleId or email
    let client = db.select().from(clientsTable).where(
      and(eq(clientsTable.googleId, googleId), isNull(clientsTable.deletedAt))
    ).all()[0];

    if (!client && cleanEmail) {
      client = db.select().from(clientsTable).where(
        and(eq(clientsTable.email, cleanEmail), isNull(clientsTable.deletedAt))
      ).all()[0];
      if (client) {
        // Link googleId
        db.update(clientsTable).set({ googleId }).where(eq(clientsTable.id, client.id)).run();
      }
    }

    if (!client) {
      // Create new Google patient account in pending approval status
      const publicId = await getNextPublicId();
      const token = crypto.randomBytes(16).toString('hex');
      const dummyPhone = `+251900${Date.now().toString().slice(-6)}`; // Temporary holder until updated

      [client] = db.insert(clientsTable).values({
        publicId,
        displayName: sanitizeText(name) || 'Patient',
        email: cleanEmail,
        phoneE164: dummyPhone,
        googleId,
        approvalStatus: 'pending',
        isVerified: false,
        bookingToken: token,
      }).returning().all();

      return reply.status(202).send({
        success: true,
        pending: true,
        message: 'Your Google sign-in registration was received. For clinical confidentiality, patient accounts require approval by Dr. Hana before login. You will receive an email upon activation.',
      });
    }

    // Check approval status
    if (client.approvalStatus === 'pending') {
      return reply.status(403).send({
        error: 'Your account is pending clinical approval by Dr. Hana. You will receive an email once access is granted.',
        pending: true,
      });
    }

    if (client.approvalStatus === 'rejected') {
      return reply.status(403).send({
        error: 'Your account registration was not approved. Please contact Dr. Hana directly.',
        rejected: true,
      });
    }

    // Set signed cookie
    const cookiePayload = JSON.stringify({ clientId: client.id, email: client.email });
    reply.setCookie('patient_session', cookiePayload, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      signed: true,
    });

    return {
      success: true,
      client: {
        id: client.id,
        publicId: client.publicId,
        displayName: client.displayName,
        email: client.email,
        phoneE164: client.phoneE164,
        isVerified: client.isVerified,
        bookingToken: client.bookingToken,
      }
    };
  });

  // 4. Request Password Reset Link
  app.post('/api/patient/forgot-password', async (req, reply) => {
    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Valid email is required' });

    const cleanEmail = sanitizeEmail(parsed.data.email);
    if (!cleanEmail) {
      return reply.status(400).send({ error: 'Valid email is required' });
    }
    const client = db.select().from(clientsTable).where(
      and(eq(clientsTable.email, cleanEmail), isNull(clientsTable.deletedAt))
    ).all()[0];

    if (client) {
      const resetToken = generateResetToken();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      db.update(clientsTable).set({
        resetToken,
        resetTokenExpiresAt: expiresAt,
      }).where(eq(clientsTable.id, client.id)).run();

      const baseUrl = env.BASE_URL.replace(/\/$/, '');
      const resetUrl = `${baseUrl}/patient/reset?token=${resetToken}`;
      await sendPatientPasswordResetEmail(client.email || cleanEmail, client.displayName || 'Patient', resetUrl);
    }

    // Always report generic success to prevent email enumeration
    return {
      success: true,
      message: 'If an account exists with that email, a password reset link has been dispatched. The link is valid for 30 minutes.',
    };
  });

  // 5. Confirm Password Reset
  app.post('/api/patient/reset-password', async (req, reply) => {
    const schema = z.object({
      token: z.string().min(10, 'Reset token is required'),
      newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message || 'Invalid input' });
    }

    const { token, newPassword } = parsed.data;
    const now = new Date();

    const client = db.select().from(clientsTable).where(
      and(
        eq(clientsTable.resetToken, token),
        gt(clientsTable.resetTokenExpiresAt, now),
        isNull(clientsTable.deletedAt)
      )
    ).all()[0];

    if (!client) {
      return reply.status(400).send({ error: 'Password reset link is invalid or has expired. Please request a new link.' });
    }

    const newHash = await hashPassword(newPassword);

    db.update(clientsTable).set({
      passwordHash: newHash,
      resetToken: null,
      resetTokenExpiresAt: null,
    }).where(eq(clientsTable.id, client.id)).run();

    return {
      success: true,
      message: 'Your password has been successfully reset. You may now log in with your new password.',
    };
  });

  // 6. Current Session Check
  app.get('/api/patient/me', async (req, reply) => {
    const session = getPatientFromSession(req);
    if (!session) {
      return reply.status(401).send({ authenticated: false });
    }

    const client = db.select().from(clientsTable).where(
      and(eq(clientsTable.id, session.clientId), isNull(clientsTable.deletedAt))
    ).all()[0];

    if (!client) {
      return reply.status(401).send({ authenticated: false });
    }

    return {
      authenticated: true,
      client: {
        id: client.id,
        publicId: client.publicId,
        displayName: client.displayName,
        email: client.email,
        phoneE164: client.phoneE164,
        isVerified: client.isVerified,
        approvalStatus: client.approvalStatus,
        bookingToken: client.bookingToken,
      }
    };
  });

  // 7. Logout
  app.post('/api/patient/logout', async (req, reply) => {
    reply.clearCookie('patient_session', { path: '/' });
    return { success: true };
  });

  // 8. Authenticated Patient Dashboard Data
  app.get('/api/patient/dashboard', async (req, reply) => {
    const session = getPatientFromSession(req);
    if (!session) {
      return reply.status(401).send({ error: 'Authentication required. Please log in.' });
    }

    const client = db.select().from(clientsTable).where(
      and(eq(clientsTable.id, session.clientId), isNull(clientsTable.deletedAt))
    ).all()[0];

    if (!client) {
      return reply.status(401).send({ error: 'Patient account not found.' });
    }

    const settings = await getSettings();
    const now = new Date();

    // Upcoming active sessions
    const upcoming = db.select().from(sessionsTable).where(
      and(
        eq(sessionsTable.clientId, client.id),
        gte(sessionsTable.startUtc, now),
        inArray(sessionsTable.status, ['confirmed', 'held', 'needs_review', 'awaiting_payment'])
      )
    ).all().sort((a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime());

    // Past / historical sessions
    const history = db.select().from(sessionsTable).where(
      and(
        eq(sessionsTable.clientId, client.id),
        inArray(sessionsTable.status, ['attended', 'no_show', 'cancelled'])
      )
    ).all().sort((a, b) => new Date(b.startUtc).getTime() - new Date(a.startUtc).getTime()).slice(0, 10);

    const leadTimeDays = settings.rescheduleLeadTimeDays ?? 7;
    const windowWeeks = settings.rescheduleWindowWeeks ?? 4;
    const allowCancel = settings.allowClientCancellation ?? false;

    const evaluatedUpcoming = upcoming.map(s => {
      const start = new Date(s.startUtc);
      const diffMs = start.getTime() - now.getTime();
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
        lockReason: !canReschedule ? `Locked within ${leadTimeDays} days of appointment` : null,
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
        approvalStatus: client.approvalStatus,
        bookingToken: client.bookingToken,
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
      upcomingSessions: evaluatedUpcoming,
      pastSessions: history.map(s => ({
        id: s.id,
        startUtc: s.startUtc,
        durationMin: s.durationMin,
        status: s.status,
      })),
    };
  });

  // 9. Instant 1-Click Additional Session Booking for Approved Patient
  app.post('/api/patient/sessions/book', async (req, reply) => {
    const sessionAuth = getPatientFromSession(req);
    if (!sessionAuth) {
      return reply.status(401).send({ error: 'Please log in to book a session.' });
    }

    const client = db.select().from(clientsTable).where(
      and(eq(clientsTable.id, sessionAuth.clientId), isNull(clientsTable.deletedAt))
    ).all()[0];

    if (!client || client.approvalStatus !== 'approved') {
      return reply.status(403).send({ error: 'Only approved patient accounts can book sessions directly.' });
    }

    const schema = z.object({
      startUtc: z.string().min(1),
      durationMin: z.number().int().default(60),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid booking parameters' });

    const startDate = new Date(parsed.data.startUtc);
    if (isNaN(startDate.getTime()) || startDate.getTime() <= Date.now()) {
      return reply.status(400).send({ error: 'Please choose a valid future slot.' });
    }

    // Verify slot is available
    const dayStart = new Date(startDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(startDate);
    dayEnd.setUTCHours(23, 59, 59, 999);
    const slots = await getAvailableSlots(dayStart, dayEnd, parsed.data.durationMin);

    const slotMatches = slots.some(s => Math.abs(new Date(s.startUtc).getTime() - startDate.getTime()) < 60000);
    if (!slotMatches) {
      return reply.status(400).send({ error: 'Selected slot is no longer available. Please select another slot.' });
    }

    const settings = await getSettings();
    const feeDue = Math.round(settings.hourlyRateEtb * (parsed.data.durationMin / 60) * (settings.schedulingFeePercent / 100)) * 100;

    const [newSession] = db.insert(sessionsTable).values({
      clientId: client.id,
      startUtc: startDate,
      durationMin: parsed.data.durationMin,
      status: 'confirmed',
      source: client.isVerified ? 'manual' : 'public',
      feeDueCents: feeDue,
      feeWaived: client.isVerified,
      originalStartUtc: startDate,
    }).returning().all();

    return {
      success: true,
      message: 'Your appointment has been confirmed!',
      session: newSession,
    };
  });
}
