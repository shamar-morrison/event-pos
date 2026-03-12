export function centsToDollars(cents: number): number {
  return cents / 100;
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function formatMoney(cents: number): string {
  const abs = Math.abs(cents);
  const sign = cents < 0 ? '-' : '';
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}$${dollars}.${remainder.toString().padStart(2, '0')}`;
}

export function calculateLineTotal(unitPriceCents: number, qty: number): number {
  return unitPriceCents * qty;
}

export function parseDollarInput(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, '');
  if (!cleaned || cleaned === '.') return null;
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed) || parsed < 0) return null;
  return dollarsToCents(parsed);
}
