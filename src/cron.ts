import cron from 'node-cron';
import { db } from './db';
import { sessionsTable, clientsTable } from './db/schema';
import { sendPushNotification } from './services/notification.service';
import { eq, and, gt, lt } from 'drizzle-orm';
import { addHours, subMinutes } from 'date-fns';

export function startCronJobs() {
  console.log('Starting cron jobs...');

  // Run every minute
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    
    // 4 hours before session
    const targetStart = addHours(now, 4);
    const windowStart = subMinutes(targetStart, 1);
    const windowEnd = targetStart;

    const upcomingSessions = db.select({
      session: sessionsTable,
      client: clientsTable
    })
    .from(sessionsTable)
    .leftJoin(clientsTable, eq(sessionsTable.clientId, clientsTable.id))
    .where(
      and(
        eq(sessionsTable.status, 'confirmed'),
        gt(sessionsTable.startUtc, windowStart),
        lt(sessionsTable.startUtc, windowEnd)
      )
    ).all();

    for (const { session, client } of upcomingSessions) {
      if (!client) continue;
      
      const timeStr = new Date(session.startUtc).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      await sendPushNotification({
        title: 'Session Reminder',
        body: `Appointment at ${timeStr} today. Remind client ${client.displayName}?`,
        data: { sessionId: session.id, phone: client.phoneE164 }
      });
    }

    // Morning summary (e.g. at 07:00 EAT = 04:00 UTC)
    if (now.getUTCHours() === 4 && now.getUTCMinutes() === 0) {
      // Find today's sessions
      // (Implementation left for actual production use, just logging for now)
      console.log('Sending morning summary push...');
      await sendPushNotification({
        title: 'Morning Summary',
        body: 'You have appointments today.'
      });
    }
  });
}
