import { db } from '../db';
import { holidaysTable, blocksTable, sessionsTable } from '../db/schema';
import { getSettings } from './settings.service';
import { and, gte, lt, eq } from 'drizzle-orm';
import { addMinutes, startOfDay, endOfDay, format, getDay, isBefore } from 'date-fns';

export interface Slot {
  startUtc: Date;
  durationMin: number;
}

export async function getAvailableSlots(fromUtc: Date, toUtc: Date, durationMin: number): Promise<Slot[]> {
  const settings = await getSettings();
  
  // Enforce horizon and minimum notice
  const now = new Date();
  const minNoticeTime = addMinutes(now, settings.minimumNoticeMin);
  const horizonTime = addMinutes(now, settings.bookingHorizonDays * 24 * 60);

  const effectiveFrom = new Date(Math.max(fromUtc.getTime(), minNoticeTime.getTime()));
  const effectiveTo = new Date(Math.min(toUtc.getTime(), horizonTime.getTime()));

  if (effectiveFrom >= effectiveTo) return [];

  // Fetch constraints from DB
  const holidays = await db.select().from(holidaysTable).where(eq(holidaysTable.active, true));
  const holidayDates = new Set(holidays.map(h => h.date)); // 'YYYY-MM-DD'

  const blocks = await db.select().from(blocksTable)
    .where(and(lt(blocksTable.startUtc, effectiveTo), gte(blocksTable.endUtc, effectiveFrom)));
    
  const sessions = await db.select().from(sessionsTable)
    .where(and(
      lt(sessionsTable.startUtc, effectiveTo),
      gte(sessionsTable.startUtc, addMinutes(effectiveFrom, -(180 + settings.bufferMin))), // buffer before
      // status not cancelled/expired
    ));
    
  const activeSessions = sessions.filter(s => !['cancelled', 'expired'].includes(s.status));

  // Build free time intervals (very simplified approach for now: check every 30 mins)
  const slots: Slot[] = [];
  const intervalMin = 30; 
  
  let current = new Date(effectiveFrom);
  // Round up to next interval
  const remainder = current.getMinutes() % intervalMin;
  if (remainder !== 0) {
    current = addMinutes(current, intervalMin - remainder);
  }

  while (current < effectiveTo) {
    const slotEnd = addMinutes(current, durationMin);
    const slotEndWithBuffer = addMinutes(slotEnd, settings.bufferMin);
    
    // 1. Working hours check
    // We assume timezones: the app runs in UTC but displays in Africa/Addis_Ababa (UTC+3)
    // We should do math in UTC+3
    const localTime = addMinutes(current, 3 * 60); // Quick UTC+3 conversion
    const localDateStr = localTime.toISOString().split('T')[0];
    const weekday = localTime.getUTCDay().toString();
    const localHours = localTime.getUTCHours();
    const localMins = localTime.getUTCMinutes();
    const startMins = localHours * 60 + localMins;
    
    const endLocalTime = addMinutes(slotEnd, 3 * 60);
    const endHours = endLocalTime.getUTCHours();
    const endMins = endLocalTime.getUTCMinutes();
    const endMinsTotal = endHours * 60 + endMins;

    // Holiday?
    if (holidayDates.has(localDateStr)) {
      current = addMinutes(current, intervalMin);
      continue;
    }

    // Within working hours?
    const dayHours = settings.workingHours[weekday];
    let withinHours = false;
    if (dayHours && endMinsTotal > startMins) {
      for (const h of dayHours) {
        const [hStartHr, hStartMin] = h.start.split(':').map(Number);
        const [hEndHr, hEndMin] = h.end.split(':').map(Number);
        const hStartTotal = hStartHr * 60 + hStartMin;
        const hEndTotal = hEndHr * 60 + hEndMin;
        
        if (startMins >= hStartTotal && endMinsTotal <= hEndTotal) {
          withinHours = true;
          break;
        }
      }
    }
    
    if (!withinHours) {
      current = addMinutes(current, intervalMin);
      continue;
    }

    // 2. Overlaps with block?
    const overlapsBlock = blocks.some(b => {
      return (current < b.endUtc && slotEnd > b.startUtc); // simple overlap
    });
    if (overlapsBlock) {
      current = addMinutes(current, intervalMin);
      continue;
    }

    // 3. Overlaps with existing session + buffer?
    const overlapsSession = activeSessions.some(s => {
      const sStart = s.startUtc;
      const sEnd = addMinutes(sStart, s.durationMin + settings.bufferMin);
      return (current < sEnd && slotEndWithBuffer > sStart);
    });

    if (!overlapsSession) {
      slots.push({
        startUtc: new Date(current),
        durationMin,
      });
    }

    current = addMinutes(current, intervalMin);
  }

  return slots;
}
