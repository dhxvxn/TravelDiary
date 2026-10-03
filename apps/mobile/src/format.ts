// Hand-rolled instead of Intl.DateTimeFormat#formatRange, which Hermes doesn't reliably support.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDateRange(start: Date, end: Date): string {
  const [d1, m1, y1] = [start.getDate(), MONTHS[start.getMonth()], start.getFullYear()];
  const [d2, m2, y2] = [end.getDate(), MONTHS[end.getMonth()], end.getFullYear()];
  if (y1 !== y2) return `${d1} ${m1} ${y1} – ${d2} ${m2} ${y2}`;
  if (m1 !== m2) return `${d1} ${m1} – ${d2} ${m2} ${y2}`;
  if (d1 !== d2) return `${d1}–${d2} ${m1} ${y2}`;
  return `${d1} ${m1} ${y1}`;
}

export function formatNumber(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export const formatKm = (km: number) => `${formatNumber(km)} km`;
export const plural = (n: number, one: string, many = `${one}s`) => `${formatNumber(n)} ${n === 1 ? one : many}`;
