import { db } from './index';
import { holidaysTable } from './schema';
import { eq } from 'drizzle-orm';

export const ETHIOPIAN_HOLIDAYS = [
  // 2026
  { date: '2026-01-07', name: 'Genna (Ethiopian Christmas)' },
  { date: '2026-01-19', name: 'Timket (Epiphany)' },
  { date: '2026-03-02', name: 'Victory of Adwa' },
  { date: '2026-03-20', name: 'Eid al-Fitr' },
  { date: '2026-04-10', name: 'Siklet (Ethiopian Good Friday)' },
  { date: '2026-04-12', name: 'Fasika (Ethiopian Easter)' },
  { date: '2026-05-01', name: "International Workers' Day" },
  { date: '2026-05-05', name: "Patriots' Victory Day" },
  { date: '2026-05-27', name: 'Eid al-Adha (Arafa)' },
  { date: '2026-05-28', name: 'Downfall of the Derg' },
  { date: '2026-08-26', name: "Mawlid (Prophet's Birthday)" },
  { date: '2026-09-11', name: 'Enkutatash (Ethiopian New Year 2019 E.C.)' },
  { date: '2026-09-27', name: 'Meskel (Finding of the True Cross)' },

  // 2027
  { date: '2027-01-07', name: 'Genna (Ethiopian Christmas)' },
  { date: '2027-01-19', name: 'Timket (Epiphany)' },
  { date: '2027-03-02', name: 'Victory of Adwa' },
  { date: '2027-03-10', name: 'Eid al-Fitr' },
  { date: '2027-04-30', name: 'Siklet (Ethiopian Good Friday)' },
  { date: '2027-05-01', name: "International Workers' Day" },
  { date: '2027-05-02', name: 'Fasika (Ethiopian Easter)' },
  { date: '2027-05-05', name: "Patriots' Victory Day" },
  { date: '2027-05-16', name: 'Eid al-Adha (Arafa)' },
  { date: '2027-05-28', name: 'Downfall of the Derg' },
  { date: '2027-08-15', name: "Mawlid (Prophet's Birthday)" },
  { date: '2027-09-12', name: 'Enkutatash (Ethiopian New Year 2020 E.C.)' },
  { date: '2027-09-28', name: 'Meskel (Finding of the True Cross)' },
];

export async function seedHolidays() {
  console.log('Seeding Ethiopian public holidays...');
  
  // Clean up any old dummy test holiday
  await db.delete(holidaysTable).where(eq(holidaysTable.name, 'Test Holiday'));

  const existing = await db.select().from(holidaysTable).all();
  const existingDates = new Set(existing.map(h => h.date));

  let insertedCount = 0;
  for (const h of ETHIOPIAN_HOLIDAYS) {
    if (!existingDates.has(h.date)) {
      await db.insert(holidaysTable).values({
        date: h.date,
        name: h.name,
        active: true,
      });
      insertedCount++;
    }
  }

  console.log(`Successfully seeded ${insertedCount} holidays (total ${existingDates.size + insertedCount}).`);
}

// Run directly if invoked from CLI
if (require.main === module || process.argv[1]?.includes('seedHolidays')) {
  seedHolidays()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
