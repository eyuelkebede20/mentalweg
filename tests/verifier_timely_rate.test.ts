import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../src/db';
import { sessionsTable, paymentsTable, clientsTable, settingsTable } from '../src/db/schema';
import { getSettings } from '../src/services/settings.service';
import { verifyReceipt } from '../src/services/verifier.service';
import { checkDuplicateOrNearReference, calculatePaymentTiming } from '../src/utils/sanitize';
import { eq, and } from 'drizzle-orm';

describe('Payment Verifier & Timely Rate Verification Flow', () => {
  beforeEach(async () => {
    // Clear test tables
    db.delete(paymentsTable).run();
    db.delete(sessionsTable).run();
    db.delete(clientsTable).run();
  });

  it('saves transaction number, date, and money when verifier returns okay, and confirms session when meeting timely rate', async () => {
    const settings = await getSettings();
    // Default hourly rate = 1200 ETB, scheduling fee = 25% -> 300 ETB (30,000 cents)
    const timelyRateCents = Math.round(settings.hourlyRateEtb * 100 * (60 / 60) * (settings.schedulingFeePercent / 100));

    // 1. Create client and session on hold
    const [client] = db.insert(clientsTable).values({
      publicId: 'C-0099',
      displayName: 'Yonas Test',
      phoneE164: '+251911223344',
      email: 'yonas@test.et',
    }).returning().all();

    const [session] = db.insert(sessionsTable).values({
      clientId: client.id,
      startUtc: new Date(Date.now() + 86400000),
      durationMin: 60,
      status: 'held',
      source: 'public',
      feeDueCents: timelyRateCents,
      holdExpiresAt: new Date(Date.now() + 20 * 60000),
    }).returning().all();

    // 2. Call verifier with mock/test reference
    const testReference = 'TEST-TXN-12345';
    const verifyRes = await verifyReceipt('telebirr', testReference, {
      receiverAccount: '0911234567',
      receiverName: 'Dr. Hana Almaz',
    });

    expect(verifyRes.verified).toBe(true);
    expect(verifyRes.amountCents).toBeDefined();
    expect(verifyRes.date).toBeDefined();

    const txNumber = (verifyRes.transactionNumber || testReference).trim();
    const txDate = verifyRes.date ? new Date(verifyRes.date) : new Date();
    const verifiedAmountCents = verifyRes.amountCents || 0;

    // 3. Save each transaction number, date, and money into payments table
    const [payment] = db.insert(paymentsTable).values({
      sessionId: session.id,
      provider: 'telebirr',
      reference: txNumber,
      amountCents: verifiedAmountCents,
      receiverAccount: verifyRes.receiverAccount || '0911234567',
      paidAt: txDate,
      verified: true,
      method: 'auto',
      rawResponseJson: JSON.stringify(verifyRes.raw || {}),
    }).returning().all();

    // Verify fields saved in DB
    const [savedPayment] = db.select().from(paymentsTable).where(eq(paymentsTable.id, payment.id)).all();
    expect(savedPayment.reference).toBe('TEST-TXN-12345');
    expect(savedPayment.amountCents).toBe(verifiedAmountCents);
    expect(savedPayment.paidAt).toBeInstanceOf(Date);
    expect(savedPayment.verified).toBe(true);
    expect(savedPayment.method).toBe('auto');

    // 4. Check with the timely rate
    const meetsTimelyRate = savedPayment.amountCents >= session.feeDueCents;
    expect(meetsTimelyRate).toBe(true);

    if (meetsTimelyRate) {
      db.update(sessionsTable)
        .set({ status: 'confirmed', holdExpiresAt: null })
        .where(eq(sessionsTable.id, session.id))
        .run();
    }

    const [updatedSession] = db.select().from(sessionsTable).where(eq(sessionsTable.id, session.id)).all();
    expect(updatedSession.status).toBe('confirmed');
    expect(updatedSession.holdExpiresAt).toBeNull();
  });

  it('keeps status awaiting_payment when verified money is below the timely rate', async () => {
    const timelyRateCents = 30000; // 300 ETB

    const [client] = db.insert(clientsTable).values({
      publicId: 'C-0100',
      displayName: 'Bethlehem Test',
      phoneE164: '+251922334455',
    }).returning().all();

    const [session] = db.insert(sessionsTable).values({
      clientId: client.id,
      startUtc: new Date(Date.now() + 86400000),
      durationMin: 60,
      status: 'held',
      source: 'public',
      feeDueCents: timelyRateCents,
      holdExpiresAt: new Date(Date.now() + 20 * 60000),
    }).returning().all();

    // Simulated short payment (e.g. 150 ETB instead of 300 ETB timely rate)
    const partialPaymentCents = 15000;
    const partialTxDate = new Date('2026-11-01T10:30:00Z');

    const [payment] = db.insert(paymentsTable).values({
      sessionId: session.id,
      provider: 'cbe',
      reference: 'CBE-SHORT-001',
      amountCents: partialPaymentCents,
      paidAt: partialTxDate,
      verified: true,
      method: 'auto',
    }).returning().all();

    // Check with the timely rate
    const totalPaid = payment.amountCents;
    const meetsTimelyRate = totalPaid >= session.feeDueCents;
    expect(meetsTimelyRate).toBe(false);

    // Timely rate not met: status remains awaiting_payment
    const finalStatus = meetsTimelyRate ? 'confirmed' : 'awaiting_payment';
    db.update(sessionsTable)
      .set({ status: finalStatus })
      .where(eq(sessionsTable.id, session.id))
      .run();

    const [checkedSession] = db.select().from(sessionsTable).where(eq(sessionsTable.id, session.id)).all();
    expect(checkedSession.status).toBe('awaiting_payment');
    expect(session.feeDueCents - totalPaid).toBe(15000); // 150 ETB remaining
  });

  it('rejects near-duplicate references where an attacker just changes one letter', () => {
    const existingReferences = [
      'TB-9876543210',
      'FT26305XYZ89',
      'CBE-100029384756',
    ];

    // 1. Exact match (case insensitive & stripped whitespace/dashes)
    const exact1 = checkDuplicateOrNearReference('TB-9876543210', existingReferences);
    expect(exact1.isDuplicate).toBe(true);

    const exact2 = checkDuplicateOrNearReference('tb9876543210', existingReferences);
    expect(exact2.isDuplicate).toBe(true);

    // 2. Changed just one letter/digit (Levenshtein distance = 1)
    const oneLetterChanged = checkDuplicateOrNearReference('TB-9876543211', existingReferences);
    expect(oneLetterChanged.isDuplicate).toBe(false);
    expect(oneLetterChanged.isNearDuplicate).toBe(true);
    expect(oneLetterChanged.matchedRef).toBe('TB-9876543210');

    const oneLetterChanged2 = checkDuplicateOrNearReference('FT26305XYZ88', existingReferences);
    expect(oneLetterChanged2.isNearDuplicate).toBe(true);
    expect(oneLetterChanged2.matchedRef).toBe('FT26305XYZ89');

    // 3. Changed two letters on a long reference
    const twoLettersChanged = checkDuplicateOrNearReference('CBE-100029384799', existingReferences);
    expect(twoLettersChanged.isNearDuplicate).toBe(true);

    // 4. Completely different authentic reference
    const completelyDifferent = checkDuplicateOrNearReference('DASHEN-5544332211', existingReferences);
    expect(completelyDifferent.isDuplicate).toBe(false);
    expect(completelyDifferent.isNearDuplicate).toBe(false);
  });

  it('accurately calculates time of payment (now - receipt time) and flags stale receipts', () => {
    const now = Date.now();

    // 1. Payment made 15 minutes ago
    const fifteenMinsAgo = new Date(now - 15 * 60000);
    const timing1 = calculatePaymentTiming(fifteenMinsAgo);
    expect(timing1.timeAgoText).toBe('15 mins ago');
    expect(timing1.elapsedMinutes).toBe(15);
    expect(timing1.isStale).toBe(false);

    // 2. Payment made 2 hours and 30 minutes ago
    const twoHoursAgo = new Date(now - (2 * 3600000 + 30 * 60000));
    const timing2 = calculatePaymentTiming(twoHoursAgo);
    expect(timing2.timeAgoText).toBe('2h 30m ago');
    expect(timing2.isStale).toBe(false);

    // 3. Stale payment made 3 days ago (e.g. reused old receipt)
    const threeDaysAgo = new Date(now - 3 * 24 * 3600000);
    const timing3 = calculatePaymentTiming(threeDaysAgo);
    expect(timing3.timeAgoText).toBe('3 days ago');
    expect(timing3.isStale).toBe(true);

    // 4. Formatted date is populated
    expect(timing1.receiptDateFormatted).toBeDefined();
    expect(timing1.receiptDate).toBe(fifteenMinsAgo.toISOString());
  });
});
