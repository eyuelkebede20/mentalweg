import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { db } from '../src/db';
import { clientsTable, sessionsTable, sessionChangesTable, settingsTable } from '../src/db/schema';
import { buildApp } from '../src/app';
import { updateSettings } from '../src/services/settings.service';

describe('Reschedule and Cancellation Policy', () => {
  let app: any;
  const mockToken = 'test-verified-token-123';

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(async () => {
    await updateSettings({
      rescheduleLeadTimeDays: 7,
      rescheduleWindowWeeks: 4,
      allowClientCancellation: false,
      cancellationPolicyText: 'Appointments cannot be rescheduled or cancelled within 7 days.',
      workingHours: {
        '1': [{ start: '09:00', end: '17:00' }],
        '2': [{ start: '09:00', end: '17:00' }],
        '3': [{ start: '09:00', end: '17:00' }],
        '4': [{ start: '09:00', end: '17:00' }],
        '5': [{ start: '09:00', end: '17:00' }],
      }
    });

    await db.delete(sessionChangesTable);
    await db.delete(sessionsTable);
    await db.delete(clientsTable);
  });

  it('correctly reports canReschedule=false when appointment is inside lead time cutoff', async () => {
    // Client verified
    const [client] = await db.insert(clientsTable).values({
      publicId: 'C-0099',
      displayName: 'Abebe Bikila',
      phoneE164: '+251911223344',
      isVerified: true,
      bookingToken: mockToken,
    }).returning();

    // Session 2 days in the future (inside 7-day cutoff)
    const sessionStart = new Date();
    sessionStart.setDate(sessionStart.getDate() + 2);

    await db.insert(sessionsTable).values({
      clientId: client.id,
      startUtc: sessionStart,
      durationMin: 60,
      status: 'confirmed',
      source: 'manual',
      feeDueCents: 30000,
      feeWaived: true,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/m/${mockToken}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.client.displayName).toBe('Abebe Bikila');
    expect(body.policy.rescheduleLeadTimeDays).toBe(7);
    expect(body.sessions.length).toBe(1);
    expect(body.sessions[0].canReschedule).toBe(false);
    expect(body.sessions[0].lockReason).toContain('7 days');
  });

  it('rejects client reschedule when inside cutoff threshold', async () => {
    const [client] = await db.insert(clientsTable).values({
      publicId: 'C-0098',
      displayName: 'Tigist Assefa',
      phoneE164: '+251911556677',
      isVerified: true,
      bookingToken: mockToken,
    }).returning();

    // Session 3 days in the future
    const sessionStart = new Date();
    sessionStart.setDate(sessionStart.getDate() + 3);

    const [session] = await db.insert(sessionsTable).values({
      clientId: client.id,
      startUtc: sessionStart,
      durationMin: 60,
      status: 'confirmed',
      source: 'manual',
      feeDueCents: 30000,
    }).returning();

    const newTarget = new Date();
    newTarget.setDate(newTarget.getDate() + 14);

    const res = await app.inject({
      method: 'POST',
      url: `/api/m/${mockToken}/sessions/${session.id}/reschedule`,
      payload: { newStartUtc: newTarget.toISOString() },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.locked).toBe(true);
    expect(body.error).toContain('within 7 days');
  });

  it('allows client reschedule when outside cutoff threshold and creates audit record', async () => {
    const [client] = await db.insert(clientsTable).values({
      publicId: 'C-0097',
      displayName: 'Derartu Tulu',
      phoneE164: '+251911889900',
      isVerified: true,
      bookingToken: mockToken,
    }).returning();

    // Session 12 days in the future (outside 7-day cutoff)
    const sessionStart = new Date();
    sessionStart.setDate(sessionStart.getDate() + 12);
    // Align to Monday 10:00 AM UTC (1:00 PM EAT) to match working hours
    sessionStart.setUTCHours(10, 0, 0, 0);
    // Find next Monday
    while (sessionStart.getUTCDay() !== 1) {
      sessionStart.setDate(sessionStart.getDate() + 1);
    }

    const [session] = await db.insert(sessionsTable).values({
      clientId: client.id,
      startUtc: sessionStart,
      durationMin: 60,
      status: 'confirmed',
      source: 'manual',
      feeDueCents: 30000,
    }).returning();

    // New target: Tuesday of that week at 10:00 AM UTC
    const targetDate = new Date(sessionStart);
    targetDate.setDate(targetDate.getDate() + 1); // Tuesday

    const res = await app.inject({
      method: 'POST',
      url: `/api/m/${mockToken}/sessions/${session.id}/reschedule`,
      payload: { newStartUtc: targetDate.toISOString() },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    // Verify session updated
    const updated = await db.select().from(sessionsTable);
    expect(new Date(updated[0].startUtc).getTime()).toBe(targetDate.getTime());

    // Verify session_changes logged with by: 'client'
    const changes = await db.select().from(sessionChangesTable);
    expect(changes.length).toBe(1);
    expect(changes[0].by).toBe('client');
    expect(changes[0].sessionId).toBe(session.id);
  });

  it('rejects client direct cancellation when allowClientCancellation is false', async () => {
    const [client] = await db.insert(clientsTable).values({
      publicId: 'C-0096',
      displayName: 'Kenenisa Bekele',
      phoneE164: '+251911443322',
      isVerified: true,
      bookingToken: mockToken,
    }).returning();

    const sessionStart = new Date();
    sessionStart.setDate(sessionStart.getDate() + 14);

    const [session] = await db.insert(sessionsTable).values({
      clientId: client.id,
      startUtc: sessionStart,
      durationMin: 60,
      status: 'confirmed',
      source: 'manual',
      feeDueCents: 30000,
    }).returning();

    const res = await app.inject({
      method: 'POST',
      url: `/api/m/${mockToken}/sessions/${session.id}/cancel`,
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toContain('cancellations are disabled');
  });

  it('allows admin to cancel session at any time and logs by: "admin"', async () => {
    const [client] = await db.insert(clientsTable).values({
      publicId: 'C-0095',
      displayName: 'Haile Gebrselassie',
      phoneE164: '+251911776655',
      isVerified: true,
    }).returning();

    // Session tomorrow (inside client cutoff)
    const sessionStart = new Date();
    sessionStart.setDate(sessionStart.getDate() + 1);

    const [session] = await db.insert(sessionsTable).values({
      clientId: client.id,
      startUtc: sessionStart,
      durationMin: 60,
      status: 'confirmed',
      source: 'manual',
      feeDueCents: 30000,
    }).returning();

    // Admin cancel override
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/admin/sessions/${session.id}`,
    });

    expect(res.statusCode).toBe(200);

    // Verify session is cancelled
    const updated = await db.select().from(sessionsTable);
    expect(updated[0].status).toBe('cancelled');

    // Verify session_changes logged with by: 'admin'
    const changes = await db.select().from(sessionChangesTable);
    expect(changes.length).toBe(1);
    expect(changes[0].by).toBe('admin');
  });
});
