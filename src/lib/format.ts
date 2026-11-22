/**
 * Format a raw base-unit token amount (as a string) into a human-readable
 * decimal string using BigInt math only (no Number conversion, so values
 * above 2^53 stay exact).
 *
 * formatTokenAmount('10000000000') -> '1000'
 * formatTokenAmount('1')           -> '0.0000001'
 */
export function formatTokenAmount(raw: string, decimals = 7): string {
  const trimmed = (raw ?? '').trim();
  if (trimmed === '') return '0';

  const negative = trimmed.startsWith('-');
  const digits = negative ? trimmed.slice(1) : trimmed;

  if (!/^\d+$/.test(digits)) return raw;

  const padded = digits.padStart(decimals + 1, '0');
  const integerPart = padded.slice(0, padded.length - decimals);
  const fractionPart = decimals > 0 ? padded.slice(padded.length - decimals) : '';
  const trimmedFraction = fractionPart.replace(/0+$/, '');

  const result = trimmedFraction ? `${integerPart}.${trimmedFraction}` : integerPart;
  return negative && result !== '0' ? `-${result}` : result;
}
