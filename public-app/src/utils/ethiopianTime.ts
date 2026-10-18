/**
 * Ethiopian Date and Local Time utilities.
 * 
 * In Ethiopia:
 * 1. Timezone is East Africa Time (UTC+3, Africa/Addis_Ababa).
 * 2. Ethiopian Local Time is a 12-hour daytime cycle starting at sunrise (6:00 AM Gregorian = 12:00 morning):
 *    - 06:00 Gregorian = 12:00 Dawn/Morning (ጥዋት 12:00)
 *    - 07:00 Gregorian = 01:00 Morning (ጥዋት 1:00)
 *    - 08:00 Gregorian = 02:00 Morning (ጥዋት 2:00)
 *    - 09:00 Gregorian = 03:00 Morning (ጥዋት 3:00)
 *    - 10:00 Gregorian = 04:00 Morning (ጥዋት 4:00)
 *    - 11:00 Gregorian = 05:00 Morning (ጥዋት 5:00)
 *    - 12:00 Gregorian = 06:00 Noon (ቀን 6:00)
 *    - 13:00 Gregorian = 07:00 Afternoon (ቀን 7:00)
 *    - 14:00 Gregorian = 08:00 Afternoon (ቀን 8:00)
 *    - 15:00 Gregorian = 09:00 Afternoon (ቀን 9:00)
 *    - 16:00 Gregorian = 10:00 Afternoon (ቀን 10:00)
 *    - 17:00 Gregorian = 11:00 Afternoon (ቀን 11:00)
 *    - 18:00 Gregorian = 12:00 Evening (ማታ 12:00)
 */

export type TimeConvention = 'ethiopian' | 'gregorian';

export function getStoredTimeConvention(): TimeConvention {
  // Check cookie first
  const match = document.cookie.match(/(?:^|;\s*)time_pref=([^;]+)/);
  if (match && (match[1] === 'ethiopian' || match[1] === 'gregorian')) {
    return match[1] as TimeConvention;
  }
  // Check localStorage
  const local = localStorage.getItem('time_pref');
  if (local === 'ethiopian' || local === 'gregorian') {
    return local as TimeConvention;
  }
  // Default to ethiopian local time
  return 'ethiopian';
}

export function setStoredTimeConvention(pref: TimeConvention): void {
  // Set cookie with 1 year expiration
  const d = new Date();
  d.setTime(d.getTime() + 365 * 24 * 60 * 60 * 1000);
  document.cookie = `time_pref=${pref};expires=${d.toUTCString()};path=/;SameSite=Lax`;
  localStorage.setItem('time_pref', pref);
}

export function formatTimeSlot(
  utcDate: Date | string,
  convention: TimeConvention,
  durationMin = 60
): { primary: string; secondary: string; localHour: number } {
  const d = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  
  // Calculate EAT (UTC+3) hour and minute
  const utcHours = d.getUTCHours();
  const utcMins = d.getUTCMinutes();
  const eatHours = (utcHours + 3) % 24;
  const minsFormatted = utcMins.toString().padStart(2, '0');

  // Gregorian format (12h AM/PM)
  const gregPeriod = eatHours >= 12 ? 'PM' : 'AM';
  const greg12H = eatHours % 12 === 0 ? 12 : eatHours % 12;
  const gregEndHours = (eatHours + Math.floor(durationMin / 60)) % 24;
  const gregEnd12H = gregEndHours % 12 === 0 ? 12 : gregEndHours % 12;
  const gregEndPeriod = gregEndHours >= 12 ? 'PM' : 'AM';

  const gregStr = `${greg12H}:${minsFormatted} ${gregPeriod} – ${gregEnd12H}:${minsFormatted} ${gregEndPeriod} (GMT+3)`;

  // Ethiopian Local Time
  // Hour starting from 6:00 AM
  let ethStartHour = (eatHours - 6 + 24) % 12;
  if (ethStartHour === 0) ethStartHour = 12;

  let ethPeriod = '';
  if (eatHours >= 6 && eatHours < 12) {
    ethPeriod = 'ጥዋት (Morning)';
  } else if (eatHours >= 12 && eatHours < 18) {
    ethPeriod = 'ቀን (Afternoon)';
  } else if (eatHours >= 18 && eatHours < 24) {
    ethPeriod = 'ማታ (Evening)';
  } else {
    ethPeriod = 'ሌሊት (Night)';
  }

  let ethEndHour = (ethStartHour + Math.floor(durationMin / 60)) % 12;
  if (ethEndHour === 0) ethEndHour = 12;

  const ethStr = `${ethPeriod} ${ethStartHour}:${minsFormatted} – ${ethEndHour}:${minsFormatted}`;

  if (convention === 'ethiopian') {
    return {
      primary: ethStr,
      secondary: gregStr,
      localHour: ethStartHour
    };
  } else {
    return {
      primary: gregStr,
      secondary: ethStr,
      localHour: greg12H
    };
  }
}

export function formatEthiopianCalendarDate(date: Date): string {
  try {
    return new Intl.DateTimeFormat('en-u-ca-ethiopic', {
      month: 'short',
      day: 'numeric'
    }).format(date);
  } catch {
    return '';
  }
}
