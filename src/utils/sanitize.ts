/**
 * Input sanitization & phone normalization utilities for practice scheduler.
 */

export function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') return '';
  // Strip control chars, null bytes, HTML/XML tags
  return input
    .replace(/\0/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/["'&<>]/g, (char) => {
      switch (char) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '"': return '&quot;';
        case "'": return '&#x27;';
        default: return char;
      }
    })
    .trim();
}

export function sanitizeEmail(input: unknown): string | undefined {
  if (!input || typeof input !== 'string') return undefined;
  const clean = input.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(clean)) return undefined;
  return clean;
}

export function normalizeEthiopianPhone(input: unknown): string {
  if (typeof input !== 'string') throw new Error('Phone must be a string');
  
  // Remove non-digit and non-plus characters
  let digits = input.trim().replace(/[\s\-\(\)\.]/g, '');
  
  if (digits.startsWith('+251')) {
    digits = digits.substring(4);
  } else if (digits.startsWith('00251')) {
    digits = digits.substring(5);
  } else if (digits.startsWith('251')) {
    digits = digits.substring(3);
  } else if (digits.startsWith('0')) {
    digits = digits.substring(1);
  }

  // Must now start with 9 or 7 and be 9 digits long (e.g., 911234567 or 712345678)
  if (!/^[97]\d{8}$/.test(digits)) {
    throw new Error('Please enter a valid Ethiopian mobile number (e.g. 0911234567 or 0712345678)');
  }

  return `+251${digits}`;
}

/**
 * Normalizes payment references by converting to uppercase and stripping non-alphanumeric chars.
 */
export function normalizeReference(ref: string): string {
  if (!ref) return '';
  return ref.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Standard Levenshtein distance for string difference calculation.
 */
export function levenshteinDistance(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix: number[][] = Array.from({ length: bn + 1 }, (_, i) => [i]);
  for (let j = 0; j <= an; j++) matrix[0][j] = j;

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[bn][an];
}

/**
 * Checks if a candidate reference is an exact duplicate or near-duplicate (e.g. 1 character changed)
 * of any existing registered reference.
 */
export function checkDuplicateOrNearReference(
  candidateRef: string,
  existingReferences: string[]
): { isDuplicate: boolean; isNearDuplicate: boolean; matchedRef?: string } {
  const normCandidate = normalizeReference(candidateRef);
  if (!normCandidate) return { isDuplicate: false, isNearDuplicate: false };

  for (const existing of existingReferences) {
    const normExisting = normalizeReference(existing);
    if (!normExisting) continue;

    // Exact normalized match (e.g. TB12345 vs tb-12345)
    if (normCandidate === normExisting) {
      return { isDuplicate: true, isNearDuplicate: false, matchedRef: existing };
    }

    const dist = levenshteinDistance(normCandidate, normExisting);
    const minLen = Math.min(normCandidate.length, normExisting.length);

    // If length >= 5 and distance is 1 (user changed just one letter/digit to bypass check)
    if (minLen >= 5 && dist === 1) {
      return { isDuplicate: false, isNearDuplicate: true, matchedRef: existing };
    }

    // If length >= 8 and distance is <= 2 (user changed two letters/digits)
    if (minLen >= 8 && dist <= 2) {
      return { isDuplicate: false, isNearDuplicate: true, matchedRef: existing };
    }
  }

  return { isDuplicate: false, isNearDuplicate: false };
}

export interface PaymentTimingInfo {
  receiptDate: string | null;
  receiptDateFormatted: string;
  timeAgoText: string;
  diffMs: number | null;
  elapsedMinutes: number | null;
  elapsedHours: number | null;
  isStale: boolean;
  isFuture: boolean;
}

export function calculatePaymentTiming(
  paidAt: Date | string | null | undefined,
  createdAt?: Date | string | null
): PaymentTimingInfo {
  const now = new Date();
  const receiptDate = paidAt ? new Date(paidAt) : (createdAt ? new Date(createdAt) : null);

  if (!receiptDate || isNaN(receiptDate.getTime())) {
    return {
      receiptDate: null,
      receiptDateFormatted: 'Unknown date',
      timeAgoText: 'Date not on receipt',
      diffMs: null,
      elapsedMinutes: null,
      elapsedHours: null,
      isStale: false,
      isFuture: false,
    };
  }

  const diffMs = now.getTime() - receiptDate.getTime();
  const elapsedMinutes = Math.round(diffMs / 60000);
  const elapsedHours = parseFloat((diffMs / 3600000).toFixed(1));
  const isFuture = diffMs < -60000; // More than 1 min ahead of server clock
  const isStale = elapsedHours > 24; // Older than 24 hours

  let timeAgoText = '';
  if (isFuture) {
    timeAgoText = 'Post-dated timestamp';
  } else if (elapsedMinutes < 1) {
    timeAgoText = 'Just now (< 1 min ago)';
  } else if (elapsedMinutes < 60) {
    timeAgoText = `${elapsedMinutes} min${elapsedMinutes === 1 ? '' : 's'} ago`;
  } else if (elapsedHours < 24) {
    const hrs = Math.floor(elapsedMinutes / 60);
    const mins = elapsedMinutes % 60;
    timeAgoText = `${hrs}h ${mins}m ago`;
  } else {
    const days = Math.floor(elapsedHours / 24);
    timeAgoText = `${days} day${days === 1 ? '' : 's'} ago`;
  }

  const receiptDateFormatted = receiptDate.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Africa/Addis_Ababa',
  });

  return {
    receiptDate: receiptDate.toISOString(),
    receiptDateFormatted,
    timeAgoText,
    diffMs,
    elapsedMinutes,
    elapsedHours,
    isStale,
    isFuture,
  };
}
