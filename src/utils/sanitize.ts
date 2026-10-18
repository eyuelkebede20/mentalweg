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
