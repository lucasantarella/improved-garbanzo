export function monthToLabel(month: number): string {
  if (month < 0) return `${month} Mo`;
  if (month === 0) return 'IND';
  return `+${month} Mo`;
}

export function monthsToWeeks(months: number): number {
  return Math.round(months * 4.3);
}

export function monthsToDays(months: number): number {
  return Math.round(months * 30);
}

/**
 * Format a duration in months as a human-readable string using the
 * largest natural units: months, weeks, and days.
 * Examples: 2 → "2mo", 0.25 → "1w 1d", 1.5 → "1mo 2w 1d", 0.0333 → "1d"
 * Handles negative values (prepends sign).
 */
export function formatLag(months: number): string {
  if (months === 0) return '0';

  const sign = months < 0 ? '-' : '+';
  const totalDays = Math.round(Math.abs(months) * 30);

  if (totalDays === 0) return '0';

  const mo = Math.floor(totalDays / 30);
  const remainingDays = totalDays - mo * 30;
  const wk = Math.floor(remainingDays / 5);
  const d = remainingDays - wk * 5;

  const parts: string[] = [];
  if (mo > 0) parts.push(`${mo}mo`);
  if (wk > 0) parts.push(`${wk}w`);
  if (d > 0) parts.push(`${d}d`);

  return sign + parts.join(' ');
}
