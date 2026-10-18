import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHold } from '../src/services/hold.service';
import { db } from '../src/db';
import { sessionsTable, clientsTable } from '../src/db/schema';
import { sql } from 'drizzle-orm';

describe('Hold Service', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-01T00:00:00Z'));
    await db.delete(sessionsTable);
    await db.delete(clientsTable);
  });

  it('should create a hold successfully', async () => {
    const { client, session } = await createHold({
      displayName: 'Test User',
      phoneE164: '+251911000000',
      startUtc: new Date('2027-01-04T10:00:00Z'),
      durationMin: 60,
    });

    expect(client.publicId).toMatch(/^C-\d{4}$/);
    expect(client.displayName).toBe('Test User');
    expect(session.status).toBe('held');
    expect(session.feeDueCents).toBeGreaterThan(0);
  });

  it('should prevent holding the same slot twice concurrently', async () => {
    await createHold({
      displayName: 'First User',
      phoneE164: '+251911000001',
      startUtc: new Date('2027-01-04T12:00:00Z'),
      durationMin: 60,
    });

    await expect(
      createHold({
        displayName: 'Second User',
        phoneE164: '+251911000002',
        startUtc: new Date('2027-01-04T12:30:00Z'), // Overlaps with the first one + buffer
        durationMin: 60,
      })
    ).rejects.toThrow('Slot is no longer available');
  });
});
