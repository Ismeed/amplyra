export function nairaToKobo(naira: number): number {
  if (!Number.isFinite(naira) || naira < 0) {
    throw new Error('Amount in Naira must be a non-negative finite number');
  }
  return Math.round(naira * 100);
}

export function koboToNaira(kobo: number): number {
  return kobo / 100;
}

export function formatNgnFromKobo(kobo: number): string {
  const naira = koboToNaira(kobo);
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: naira % 1 === 0 ? 0 : 2,
  }).format(naira);
}
