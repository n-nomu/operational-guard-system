import { CURRENCY_CONFIG, type Currency } from './types';

export function formatCurrency(amount: number | undefined | null, currency: Currency): string {
  const config = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.JPY;
  const safeAmount = amount ?? 0;
  const formatted = safeAmount.toFixed(config.decimals);
  return `${config.symbol}${Number(formatted).toLocaleString()}`;
}

export function parseCurrencyInput(value: string, currency: Currency): number {
  const config = CURRENCY_CONFIG[currency];
  const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return 0;
  return config.decimals === 0 ? Math.round(num) : Math.round(num * 100) / 100;
}
