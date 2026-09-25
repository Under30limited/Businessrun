/**
 * utils/currency.js
 *
 * Frontend mirror of config/currencies.js (backend) — 13 currencies,
 * their symbols, static USD-pivot rates, and formatting helpers.
 *
 * KEEP IN SYNC WITH THE BACKEND — if you add or change a currency in
 * config/currencies.js, update this file to match, and vice versa.
 * There is no automated check enforcing this; it's a manual rule.
 */

export const FX_RATES_TO_USD = {
  USD: 1.0,
  NGN: 1500,
  KES: 130,
  GHS: 15.5,
  ZAR: 18.2,
  GBP: 0.78,
  CAD: 1.38,
  EUR: 0.92,
  AED: 3.67,
  RWF: 1350,
  UGX: 3700,
  AUD: 1.52,
  INR: 83.5,
};

export const CURRENCY_SYMBOLS = {
  USD: '$',
  NGN: '₦',
  KES: 'KSh',
  GHS: 'GH₵',
  ZAR: 'R',
  GBP: '£',
  CAD: 'CA$',
  EUR: '€',
  AED: 'AED',
  RWF: 'RWF',
  UGX: 'UGX',
  AUD: 'A$',
  INR: '₹',
};

export const CURRENCY_LABELS = {
  USD: 'US Dollar',
  NGN: 'Nigerian Naira',
  KES: 'Kenyan Shilling',
  GHS: 'Ghanaian Cedi',
  ZAR: 'South African Rand',
  GBP: 'British Pound',
  CAD: 'Canadian Dollar',
  EUR: 'Euro',
  AED: 'UAE Dirham',
  RWF: 'Rwandan Franc',
  UGX: 'Ugandan Shilling',
  AUD: 'Australian Dollar',
  INR: 'Indian Rupee',
};

export const CURRENCIES = Object.keys(FX_RATES_TO_USD);

// Currencies whose smallest everyday unit isn't meaningfully fractional
const NO_DECIMAL_CURRENCIES = ['NGN', 'KES', 'RWF', 'UGX', 'INR'];

/**
 * getCurrencySymbol
 * @param {string} currency
 * @returns {string}
 */
export function getCurrencySymbol(currency) {
  if (!currency) return '₦';
  const code = currency.toUpperCase();
  return CURRENCY_SYMBOLS[code] || code;
}

/**
 * convertAmount
 * Converts an amount from one currency to another via a USD pivot.
 *
 * @param {number} amount
 * @param {string} from
 * @param {string} to
 * @returns {number}
 */
export function convertAmount(amount, from, to) {
  if (!from || !to) return amount;
  const fromCode = from.toUpperCase();
  const toCode = to.toUpperCase();
  if (fromCode === toCode) return amount;

  const fromRate = FX_RATES_TO_USD[fromCode] || 1.0;
  const toRate = FX_RATES_TO_USD[toCode] || 1.0;

  const inUSD = amount / fromRate;
  return inUSD * toRate;
}

/**
 * formatCurrency
 * Formats a numeric amount with the appropriate currency symbol.
 *
 * @param {number} amount
 * @param {string} currency
 * @returns {string}
 */
export function formatCurrency(amount, currency) {
  const isNullOrNan = amount === null || amount === undefined || Number.isNaN(amount);
  const val = isNullOrNan ? 0 : amount;
  const symbol = getCurrencySymbol(currency);
  const code = (currency || 'NGN').toUpperCase();
  const isNoDecimal = NO_DECIMAL_CURRENCIES.includes(code);

  const maxFractionDigits = isNoDecimal ? 0 : 2;
  const minFractionDigits = isNoDecimal ? 0 : (Number.isInteger(val) ? 0 : 2);

  const formatted = val.toLocaleString('en-US', {
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxFractionDigits,
  });

  const needsSpace = symbol.length > 2 || ['KSh', 'GH₵', 'CA$', 'A$'].includes(symbol);
  return `${symbol}${needsSpace ? ' ' : ''}${formatted}`;
}

/**
 * formatUnifiedAmount
 * Converts an amount from its original currency to a display currency,
 * then formats it. Useful for screens that aggregate amounts in different
 * currencies into one unified display currency.
 *
 * @param {number} amount
 * @param {string} fromCurrency
 * @param {string} displayCurrency
 * @returns {string}
 */
export function formatUnifiedAmount(amount, fromCurrency, displayCurrency) {
  const converted = convertAmount(amount, fromCurrency, displayCurrency);
  return formatCurrency(converted, displayCurrency);
}
