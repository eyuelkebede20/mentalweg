import { z } from 'zod';
import { db } from '../db';
import { settingsTable } from '../db/schema';
import { eq } from 'drizzle-orm';

export const TrainingPosterSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),
  category: z.enum(['latest', 'previous']).default('latest'),
  imageUrl: z.string(),
  description: z.string(),
});

export type TrainingPoster = z.infer<typeof TrainingPosterSchema>;

export const PaymentAccountConfigSchema = z.object({
  id: z.string().default(() => `acc-${Date.now()}`),
  provider: z.string().default('telebirr'),
  accountNumber: z.string().default(''),
  holderName: z.string().default(''),
  instructions: z.string().nullable().optional(),
  active: z.boolean().default(true),
});

export type PaymentAccountConfig = z.infer<typeof PaymentAccountConfigSchema>;

export const SettingsSchema = z.object({
  practiceName: z.string().default('Mentalweg Psychology Practice'),
  iconUrl: z.string().default(''),
  quote: z.string().default('Healing begins when we find a space to speak without fear of judgment.'),
  quoteAuthor: z.string().default('Dr. Hana Almaz, Clinical Psychologist'),
  bio: z.string().default('A dedicated, confidential therapeutic practice providing compassionate clinical care and psychoeducation in Addis Ababa.'),
  locationText: z.string().default('Bulgaria area, near the African Union, Addis Ababa'),
  accentColor: z.string().default('#2f6b5c'),
  shiftStart: z.string().default('09:00'),
  shiftEnd: z.string().default('17:00'),
  hourlyRateEtb: z.number().int().default(1200),
  schedulingFeePercent: z.number().default(25),
  durationsOffered: z.array(z.number()).default([60]),
  bufferMin: z.number().default(10),
  bookingHorizonDays: z.number().default(30),
  minimumNoticeMin: z.number().default(0),
  holdDurationMin: z.number().default(20),
  consentText: z.string().default('I confirm that I am booking an in-person session in Addis Ababa and agree to arrive on time.'),
  consentVersion: z.string().default('1.0'),
  workingHours: z.record(z.string(), z.array(z.object({
    start: z.string(),
    end: z.string()
  }))).default({
    '1': [{ start: '09:00', end: '17:00' }], // Monday
    '2': [{ start: '09:00', end: '17:00' }], // Tuesday
    '3': [{ start: '09:00', end: '17:00' }], // Wednesday
    '4': [{ start: '09:00', end: '17:00' }], // Thursday
    '5': [{ start: '09:00', end: '17:00' }], // Friday
    '6': [{ start: '09:00', end: '13:00' }], // Saturday
  }),
  trainingPosters: z.array(TrainingPosterSchema).default([
    {
      id: 'poster-1',
      title: 'Mindfulness & Stress Resilience in the Workplace',
      date: 'Next Cohort: Nov 2026',
      category: 'latest',
      imageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
      description: 'An intensive psychoeducational workshop focusing on nervous system regulation, burnout management, and daily grounding practices.'
    },
    {
      id: 'poster-2',
      title: 'Cognitive Behavioral Insights: Navigating Anxiety',
      date: 'Completed: Aug 2026',
      category: 'previous',
      imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80',
      description: 'Practical clinical approaches to recognizing thought spirals, body awareness, and developing constructive coping routines.'
    },
    {
      id: 'poster-3',
      title: 'Family & Adolescent Dynamic Communication',
      date: 'Completed: May 2026',
      category: 'previous',
      imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=800&q=80',
      description: 'Interactive dialogue training designed for parents and young adults to build open, empathetic boundaries.'
    }
  ]),
  paymentAccounts: z.array(PaymentAccountConfigSchema).default([
    {
      id: 'acc-1',
      provider: 'telebirr',
      accountNumber: '0911234567',
      holderName: 'Dr. Hana Almaz',
      instructions: 'Pay via Telebirr app or *127# and attach confirmation SMS screenshot or transaction number.',
      active: true,
    },
    {
      id: 'acc-2',
      provider: 'cbe',
      accountNumber: '1000234567891',
      holderName: 'Dr. Hana Almaz',
      instructions: 'Transfer through Commercial Bank of Ethiopia (CBE Birr / CBE Mobile) and attach slip.',
      active: true,
    }
  ])
});

export type Settings = z.infer<typeof SettingsSchema>;

export async function getSettings(): Promise<Settings> {
  const row = await db.select().from(settingsTable).limit(1);
  if (!row.length) {
    const defaults = SettingsSchema.parse({});
    await db.insert(settingsTable).values({ data: defaults });
    return defaults;
  }
  try {
    return SettingsSchema.parse(row[0].data);
  } catch (e) {
    // Merge existing with defaults if any new keys are missing
    const merged = { ...SettingsSchema.parse({}), ...(typeof row[0].data === 'object' ? row[0].data : {}) };
    return SettingsSchema.parse(merged);
  }
}

export async function updateSettings(data: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated = { ...current, ...data };
  
  // If shiftStart or shiftEnd changed, update default working hours if they follow shiftStart/End
  if (data.shiftStart || data.shiftEnd) {
    const sStart = data.shiftStart || current.shiftStart;
    const sEnd = data.shiftEnd || current.shiftEnd;
    const hours = { ...updated.workingHours };
    ['1', '2', '3', '4', '5'].forEach(day => {
      if (hours[day] && hours[day].length > 0) {
        hours[day] = [{ start: sStart, end: sEnd }];
      }
    });
    updated.workingHours = hours;
  }

  const valid = SettingsSchema.parse(updated);
  
  const existing = await db.select().from(settingsTable).limit(1);
  if (!existing.length) {
    await db.insert(settingsTable).values({ data: valid });
  } else {
    await db.update(settingsTable).set({ data: valid }).where(eq(settingsTable.id, existing[0].id));
  }
  
  return valid;
}
