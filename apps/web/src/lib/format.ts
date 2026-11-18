const bahtWhole = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 0,
});
const bahtSatang = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  minimumFractionDigits: 2,
});

/** API money is integer satang: ฿1,200 or ฿1,200.50. */
export function formatBaht(satang: number | null | undefined): string {
  if (satang == null) return '—';
  return (satang % 100 === 0 ? bahtWhole : bahtSatang).format(satang / 100);
}

/** "1,200.50" → 120050; "" → null; anything unparseable or negative → NaN. */
export function satangFromBahtInput(input: string): number | null {
  const s = input.trim().replaceAll(',', '');
  if (s === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return Number.NaN;
  const [whole, fraction = ''] = s.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function bahtInputFromSatang(satang: number | null): string {
  if (satang == null) return '';
  return satang % 100 === 0 ? String(satang / 100) : (satang / 100).toFixed(2);
}

const dateTime = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
const date = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' });

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatDate = (isoDate: string) => date.format(new Date(isoDate));
