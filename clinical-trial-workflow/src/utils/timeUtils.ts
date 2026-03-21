export function monthToLabel(month: number): string {
  if (month < 0) return `${month} Mo`;
  if (month === 0) return 'IND';
  return `+${month} Mo`;
}

export function monthsToWeeks(months: number): number {
  return Math.round(months * 4.3);
}
