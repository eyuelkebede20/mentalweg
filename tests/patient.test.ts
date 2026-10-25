import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { db } from '../src/db';
import { clientsTable, sessionsTable, sessionChangesTable } from '../src/db/schema';
import { buildApp } from '../src/app';
import { updateSettings } from '../src/services/settings.service';

describe('Patient Authentication, Approval, and Dashboard System', () => {
  let app: any;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(async () => {
    await updateSettings({
      rescheduleLeadTimeDays: 7,
      rescheduleWindowWeeks: 4,
      allowClientCancellation: false,
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

  it('allows a patient to register in pending approval status', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/patient/signup',
      payload: {
        displayName: 'Mahlet Solomon',
        email: 'mahlet@example.com',
        phone: '0911445566',
        password: 'Password123!',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.pending).toBe(true);
    expect(body.message).toContain('require approval by Dr. Hana');

    // Verify record in database has approvalStatus = 'pending'
    const clients = await db.select().from(clientsTable);
    expect(clients.length).toBe(1);
    expect(clients[0].displayName).toBe('Mahlet Solomon');
    expect(clients[0].approvalStatus).toBe('pending');
    expect(clients[0].phoneE164).toBe('+251911445566');
    expect(clients[0].passwordHash).toBeDefined();
  });

  it('rejects login while account is pending clinical approval', async () => {
    // Register patient
    await app.inject({
      method: 'POST',
      url: '/api/patient/signup',
      payload: {
        displayName: 'Tewodros Kassahun',
        email: 'teddy@example.com',
        phone: '0911778899',
        password: 'Password123!',
      },
    });

    // Attempt login before approval
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/patient/login',
      payload: {
        email: 'teddy@example.com',
        password: 'Password123!',
      },
    });

    expect(loginRes.statusCode).toBe(403);
    const body = JSON.parse(loginRes.body);
    expect(body.pending).toBe(true);
    expect(body.error).toContain('pending clinical approval');
  });

  it('allows admin to approve patient registration, and patient can then log in', async () => {
    // 1. Signup
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/patient/signup',
      payload: {
        displayName: 'Aster Aweke',
        email: 'aster@example.com',
        phone: '0911223344',
        password: 'Password123!',
      },
    });
    expect(signupRes.statusCode).toBe(200);

    const [client] = await db.select().from(clientsTable);

    // 2. Admin views pending patients
    const pendingRes = await app.inject({
      method: 'GET',
      url: '/api/admin/patients/pending',
    });
    expect(pendingRes.statusCode).toBe(200);
    const pendingList = JSON.parse(pendingRes.body);
    expect(pendingList.length).toBe(1);
    expect(pendingList[0].id).toBe(client.id);

    // 3. Admin approves patient
    const approveRes = await app.inject({
      method: 'POST',
      url: `/api/admin/patients/${client.id}/approve`,
    });
    expect(approveRes.statusCode).toBe(200);

    // 4. Patient now logs in successfully
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/patient/login',
      payload: {
        email: 'aster@example.com',
        password: 'Password123!',
      },
    });

    expect(loginRes.statusCode).toBe(200);
    const loginBody = JSON.parse(loginRes.body);
    expect(loginBody.success).toBe(true);
    expect(loginBody.client.displayName).toBe('Aster Aweke');

    // Cookie is returned
    const cookieHeader = loginRes.headers['set-cookie'];
    expect(cookieHeader).toBeDefined();
    expect(cookieHeader).toContain('patient_session');
  });

  it('handles password reset request and password update', async () => {
    // Create approved patient
    await app.inject({
      method: 'POST',
      url: '/api/patient/signup',
      payload: {
        displayName: 'Kassahun Worku',
        email: 'kassahun@example.com',
        phone: '0911334455',
        password: 'InitialPassword123!',
      },
    });

    const [client] = await db.select().from(clientsTable);
    await app.inject({ method: 'POST', url: `/api/admin/patients/${client.id}/approve` });

    // 1. Request forgot password
    const forgotRes = await app.inject({
      method: 'POST',
      url: '/api/patient/forgot-password',
      payload: { email: 'kassahun@example.com' },
    });
    expect(forgotRes.statusCode).toBe(200);

    // Verify reset token stored
    const [updatedClient] = await db.select().from(clientsTable);
    expect(updatedClient.resetToken).toBeDefined();

    // 2. Submit new password with reset token
    const resetRes = await app.inject({
      method: 'POST',
      url: '/api/patient/reset-password',
      payload: {
        token: updatedClient.resetToken,
        newPassword: 'BrandNewPassword456!',
      },
    });

    expect(resetRes.statusCode).toBe(200);
    const resetBody = JSON.parse(resetRes.body);
    expect(resetBody.success).toBe(true);

    // 3. Login with new password
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/patient/login',
      payload: {
        email: 'kassahun@example.com',
        password: 'BrandNewPassword456!',
      },
    });
    expect(loginRes.statusCode).toBe(200);
  });

  it('supports Google OIDC signup in pending status and subsequent login', async () => {
    // Mock Google JWT credential
    const googleProfile = {
      sub: 'google-sub-id-998877',
      email: 'drhana_patient@gmail.com',
      name: 'Google Patient User',
    };
    const mockJwt = `header.${Buffer.from(JSON.stringify(googleProfile)).toString('base64')}.sig`;

    // 1. Google sign-in for first time
    const googleRes = await app.inject({
      method: 'POST',
      url: '/api/patient/auth/google',
      payload: { credential: mockJwt },
    });

    expect(googleRes.statusCode).toBe(202);
    const googleBody = JSON.parse(googleRes.body);
    expect(googleBody.pending).toBe(true);

    // 2. Admin approves patient
    const [googleClient] = await db.select().from(clientsTable);
    expect(googleClient.googleId).toBe('google-sub-id-998877');

    await app.inject({
      method: 'POST',
      url: `/api/admin/patients/${googleClient.id}/approve`,
    });

    // 3. Google sign-in after approval logs in directly
    const loginGoogleRes = await app.inject({
      method: 'POST',
      url: '/api/patient/auth/google',
      payload: { credential: mockJwt },
    });

    expect(loginGoogleRes.statusCode).toBe(200);
    const loginBody = JSON.parse(loginGoogleRes.body);
    expect(loginBody.success).toBe(true);
    expect(loginBody.client.email).toBe('drhana_patient@gmail.com');
  });

  it('allows approved patient to book an additional session directly from dashboard', async () => {
    // Create & approve patient
    await app.inject({
      method: 'POST',
      url: '/api/patient/signup',
      payload: {
        displayName: 'Solomon Bogale',
        email: 'solomon@example.com',
        phone: '0911990011',
        password: 'Password123!',
      },
    });

    const [client] = await db.select().from(clientsTable);
    await app.inject({ method: 'POST', url: `/api/admin/patients/${client.id}/approve` });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/patient/login',
      payload: { email: 'solomon@example.com', password: 'Password123!' },
    });

    const cookies = loginRes.cookies;

    // Pick upcoming Monday 10:00 AM UTC (1:00 PM EAT)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 7);
    targetDate.setUTCHours(10, 0, 0, 0);
    while (targetDate.getUTCDay() !== 1) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    // 1-click book session from dashboard
    const bookRes = await app.inject({
      method: 'POST',
      url: '/api/patient/sessions/book',
      cookies: { patient_session: cookies[0].value },
      payload: {
        startUtc: targetDate.toISOString(),
        durationMin: 60,
      },
    });

    expect(bookRes.statusCode).toBe(200);
    const bookBody = JSON.parse(bookRes.body);
    expect(bookBody.success).toBe(true);
    expect(bookBody.session.status).toBe('confirmed');

    // Verify session shows up on patient dashboard
    const dashRes = await app.inject({
      method: 'GET',
      url: '/api/patient/dashboard',
      cookies: { patient_session: cookies[0].value },
    });

    expect(dashRes.statusCode).toBe(200);
    const dashBody = JSON.parse(dashRes.body);
    expect(dashBody.upcomingSessions.length).toBe(1);
    expect(dashBody.upcomingSessions[0].canReschedule).toBe(true);
  });
});
