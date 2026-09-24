/**
 * config/currencies.js
 *
 * Every currency Personal Wealth OS supports, its display symbol, and
 * a static USD conversion rate — the backend counterpart to
 * utils/currency.js on the frontend (kept in sync deliberately; if
 * you add a currency, add it in BOTH places).
 *
 * ── WHY A STATIC TABLE, NOT A LIVE FX API ──────────────────────────
 * services/fx.service.js already does a LIVE USD→NGN rate for
 * Paystack subscription pricing — but that's one currency pair, and
 * accuracy to the naira matters there because it's real money being
 * charged. Personal Wealth OS needs thirteen currencies converting
 * freely against each other purely for DISPLAY (letting someone view
 * their net worth in whichever currency they think in) — a live rate
 * for all thirteen would mean a paid multi-currency FX API and a lot
 * more that can fail. A static table, refreshed by hand occasionally,
 * is the right tool for "roughly right, always available" the same
 * way this codebase already treats FALLBACK_USD_TO_NGN in
 * fx.service.js as acceptable for a non-critical path.
 *
 * ── WHERE THIS IS USED ──────────────────────────────────────────────
 * - personal.service.js's internal bookkeeping (crediting/debiting an
 *   Account's balance, an envelope's amountSpent) — replaces the
 *   NGN/USD-only convertAmount it used to import from fx.service.js,
 *   since an Account or Expense can now be opened in any of these
 *   thirteen currencies, not just NGN/USD.
 * - personalNetWorth.controller.js's makeConverter — so "view my net
 *   worth in GHS" works regardless of which currencies the underlying
 *   records are actually stored in.
 * - personalAssets.controller.js — converting a market-tracked
 *   asset's live USD price into the space's chosen currency.
 * - config/personalOptions.js's CURRENCIES list, which every personal
 *   controller validates record currencies against — imported from
 *   here so there is exactly one list, not two that could drift.
 *
 * Rates are USD-per-1-unit-of-this-currency's-inverse — i.e.
 * FX_RATES_TO_USD.NGN = 1500 means 1 USD = 1500 NGN (NOT the reverse).
 * convertAmount below does the actual USD-pivot math.
 */

'use strict';

const FX_RATES_TO_USD = {
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

const CURRENCY_SYMBOLS = {
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

// Every currency code this app knows about, in the same order as the
// two maps above — config/personalOptions.js's CURRENCIES re-exports
// this directly so every personal-finance controller's currency
// validation stays in sync with what these helpers can actually
// convert and symbolize.
const CURRENCIES = Object.keys(FX_RATES_TO_USD);

// Currencies whose smallest everyday unit isn't meaningfully
// fractional for display — mirrors the frontend's formatCurrency
// exactly, so a naira amount never shows kobo decimals server-side
// (e.g. in an AI data summary) while a euro amount does.
const NO_DECIMAL_CURRENCIES = ['NGN', 'KES', 'RWF', 'UGX', 'INR'];

/**
 * getCurrencySymbol
 * @param {string} currency
 * @returns {string}
 */
function getCurrencySymbol(currency) {
  if (!currency) return '₦';
  const code = currency.toUpperCase();
  return CURRENCY_SYMBOLS[code] || code;
}

/**
 * convertAmount
 * Converts an amount from one currency to another via a USD pivot.
 * Unknown currency codes fall back to a 1.0 rate (treated as USD)
 * rather than throwing — a bad/legacy currency code on an old record
 * should degrade gracefully, not break a net-worth calculation for
 * everything else in the same request.
 *
 * @param {number} amount
 * @param {string} from
 * @param {string} to
 * @returns {number}
 */
function convertAmount(amount, from, to) {
  if (!from || !to) return amount;
  const fromCode = from.toUpperCase();
  const toCode   = to.toUpperCase();
  if (fromCode === toCode) return amount;

  const fromRate = FX_RATES_TO_USD[fromCode] || 1.0;
  const toRate   = FX_RATES_TO_USD[toCode]   || 1.0;

  const inUSD = amount / fromRate;
  return inUSD * toRate;
}

/**
 * formatCurrency
 * Plain server-side formatting (e.g. for the AI data summary in
 * wealthAdvisor.service.js, or any future email/notification copy).
 * Mirrors the frontend's formatCurrency exactly.
 *
 * @param {number} amount
 * @param {string} currency
 * @returns {string}
 */
function formatCurrency(amount, currency) {
  const isNullOrNan = amount === null || amount === undefined || Number.isNaN(amount);
  const val    = isNullOrNan ? 0 : amount;
  const symbol = getCurrencySymbol(currency);
  const code   = (currency || 'NGN').toUpperCase();
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

module.exports = {
  FX_RATES_TO_USD,
  CURRENCY_SYMBOLS,
  CURRENCIES,
  NO_DECIMAL_CURRENCIES,
  getCurrencySymbol,
  convertAmount,
  formatCurrency,
};
