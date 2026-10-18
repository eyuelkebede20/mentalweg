import { db } from '../db';
import { clientsTable, sessionsTable } from '../db/schema';
import { getSettings } from './settings.service';
import { eq, and, or, lt, gte, isNull } from 'drizzle-orm';
import { addMinutes } from 'date-fns';

export async function createHold(data: {
  displayName: string;
  phoneE164: string;
  email?: string;
  guardianName?: string;
  startUtc: Date;
  durationMin: number;
}) {
  const settings = await getSettings();
  
  return db.transaction((tx) => {
    // 1. Check if slot is still available
    // For simplicity, we check if there are any overlapping sessions that are NOT cancelled/expired
    const slotEnd = addMinutes(data.startUtc, data.durationMin + settings.bufferMin);
    const slotStartWithBuffer = addMinutes(data.startUtc, -settings.bufferMin);
    
    const overlaps = tx.select().from(sessionsTable).where(
      and(
        lt(sessionsTable.startUtc, addMinutes(data.startUtc, data.durationMin + settings.bufferMin)),
        gte(sessionsTable.startUtc, addMinutes(data.startUtc, -(180 + settings.bufferMin))),
        or(
          eq(sessionsTable.status, 'held'),
          eq(sessionsTable.status, 'awaiting_payment'),
          eq(sessionsTable.status, 'confirmed'),
          eq(sessionsTable.status, 'needs_review')
        )
      )
    ).all();

    // Precise overlap check
    const hasOverlap = overlaps.some(s => {
      const sStart = s.startUtc;
      const sEnd = addMinutes(sStart, s.durationMin + settings.bufferMin);
      return (data.startUtc < sEnd && slotEnd > sStart);
    });

    if (hasOverlap) {
      throw new Error('Slot is no longer available');
    }

    // 2. Find or create client
    let [client] = tx.select().from(clientsTable).where(eq(clientsTable.phoneE164, data.phoneE164)).all();
    
    if (!client) {
      // Create new client
      // We need a unique public_id (e.g. C-0001)
      const clientsCount = tx.select().from(clientsTable).all();
      const nextId = clientsCount.length + 1;
      const publicId = `C-${nextId.toString().padStart(4, '0')}`;
      
      const insertResult = tx.insert(clientsTable).values({
        publicId,
        displayName: data.displayName,
        phoneE164: data.phoneE164,
        email: data.email,
        guardianName: data.guardianName,
      }).returning().all();
      client = insertResult[0];
    }

    // 3. Create session with hold status
    const feeDueCents = Math.round(settings.hourlyRateEtb * 100 * (data.durationMin / 60) * (settings.schedulingFeePercent / 100));
    const now = new Date();
    const holdExpiresMax = addMinutes(now, settings.holdDurationMin);
    const holdExpiresAt = data.startUtc < holdExpiresMax ? data.startUtc : holdExpiresMax;

    const [session] = tx.insert(sessionsTable).values({
      clientId: client.id,
      startUtc: data.startUtc,
      durationMin: data.durationMin,
      status: 'held',
      source: 'public',
      feeDueCents,
      holdExpiresAt,
      originalStartUtc: data.startUtc,
    }).returning().all();

    return { client, session };
  });
}
