import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAvailableSlots } from '../src/services/slot.service';
import { db } from '../src/db';
import { holidaysTable, blocksTable, sessionsTable, settingsTable } from '../src/db/schema';
import { sql } from 'drizzle-orm';

describe('Slot Service', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-01T00:00:00Z'));
    await db.delete(sessionsTable);
    await db.delete(blocksTable);
    await db.delete(holidaysTable);
    await db.delete(settingsTable);
  });

  it('should return slots within working hours', async () => {
    const fromUtc = new Date('2027-01-04T00:00:00Z'); // Monday
    const toUtc = new Date('2027-01-05T00:00:00Z');

    const slots = await getAvailableSlots(fromUtc, toUtc, 60);
    // UTC+3 means 09:00 local is 06:00 UTC, 17:00 local is 14:00 UTC
    // Working hours: 09:00 to 17:00 local
    // So 06:00 UTC to 14:00 UTC
    // Slots are 60 min. So 06:00, 06:30, 07:00 ... 13:00 (ends at 14:00)
    
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].startUtc.toISOString()).toBe('2027-01-04T06:00:00.000Z');
    
    // Last slot should end at 14:00 UTC, so starts at 13:00 UTC
    expect(slots[slots.length - 1].startUtc.toISOString()).toBe('2027-01-04T13:00:00.000Z');
  });

  it('should exclude holidays', async () => {
    // 2027-01-04 local is Monday
    await db.insert(holidaysTable).values({ date: '2027-01-04', name: 'Test Holiday' });

    const fromUtc = new Date('2027-01-04T00:00:00Z');
    const toUtc = new Date('2027-01-05T00:00:00Z');

    const slots = await getAvailableSlots(fromUtc, toUtc, 60);
    expect(slots.length).toBe(0);
  });
});
