import { describe, it, expect, beforeEach } from 'vitest';
import { createHold } from '../src/services/hold.service';
import { db } from '../src/db';
import { sessionsTable, clientsTable } from '../src/db/schema';

describe('Hold Service', () => {
  beforeEach(async () => {
    db.delete(sessionsTable).run();
    db.delete(clientsTable).run();
  });

  it('should create a hold successfully', async () => {
    const futureDate = new Date(Date.now() + 86400000);
    const { client, session } = await createHold({
      displayName: 'Test User',
      phoneE164: '+251911000000',
      startUtc: futureDate,
      durationMin: 60,
    });

    expect(client.publicId).toMatch(/^C-\d{4}$/);
    expect(client.displayName).toBe('Test User');
    expect(session.status).toBe('held');
    expect(session.feeDueCents).toBeGreaterThan(0);
  });

  it('should prevent holding the same slot twice concurrently', async () => {
    const slotTime = new Date(Date.now() + 2 * 86400000);
    await createHold({
      displayName: 'First User',
      phoneE164: '+251911000001',
      startUtc: slotTime,
      durationMin: 60,
    });

    await expect(
      createHold({
        displayName: 'Second User',
        phoneE164: '+251911000002',
        startUtc: new Date(slotTime.getTime() + 30 * 60000), // Overlaps with the first one + buffer
        durationMin: 60,
      })
    ).rejects.toThrow('Slot is no longer available');
  });
});
