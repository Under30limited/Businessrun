/**
 * services/fx.service.js
 *
 * USD → NGN exchange rate for displaying/charging naira-equivalent
 * subscription prices. Cached in-memory for 24 hours — pricing that
 * changed every few minutes would confuse customers more than it
 * would help, and this avoids hammering a third-party API on every
 * page load.
 *
 * Uses open.er-api.com — a free, keyless endpoint from the
 * long-established ExchangeRate-API family (running since 2010).
 * Rates there update daily, which matches our own cache cadence.
 *
 * Note: this is an in-memory cache, so it resets on every server
 * restart (PM2 reload/deploy) — that's fine, it just means the very
 * next request after a restart pays the cost of one live fetch, then
 * serves cached for the next 24 hours. No persistence needed for
 * something this low-stakes.
 *
 * USAGE:
 *   const { getUsdToNgnRate, convertUsdToNgn, convertAmount } = require('../services/fx.service');
 *   const rate   = await getUsdToNgnRate();       // e.g. 1450.32
 *   const ngn    = await convertUsdToNgn(6.50);    // e.g. 9427
 *   const value  = await convertAmount(100, 'USD', 'NGN'); // e.g. 145032
 */

'use strict';

const FX_API_URL   = 'https://open.er-api.com/v6/latest/USD';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// A conservative, intentionally round fallback — used ONLY if we've
// never successfully fetched a real rate AND the API call fails (e.g.
// cold start with no network). Should almost never actually be hit in
// practice; it exists so a transient outage can't break the pricing
// page or block a payment flow entirely.
const FALLBACK_USD_TO_NGN = 1500;

let cachedRate = null; // { rate: number, fetchedAt: number } | null

async function fetchLiveRate() {
  const res = await fetch(FX_API_URL);
  if (!res.ok) {
    throw new Error(`FX API returned HTTP ${res.status}`);
  }
  const data = await res.json();
  const rate = data?.rates?.NGN;
  if (typeof rate !== 'number' || rate <= 0) {
    throw new Error('FX API response did not include a valid NGN rate');
  }
  return rate;
}

/**
 * Returns the current USD→NGN rate, refreshing from the live API at
 * most once every 24 hours. On a fetch failure, serves the last known
 * good rate if one exists; falls back to a fixed conservative estimate
 * only if we've never successfully fetched at all.
 *
 * @returns {Promise<number>}
 */
async function getUsdToNgnRate() {
  const now = Date.now();

  if (cachedRate && (now - cachedRate.fetchedAt) < CACHE_TTL_MS) {
    return cachedRate.rate;
  }

  try {
    const rate = await fetchLiveRate();
    cachedRate = { rate, fetchedAt: now };
    return rate;
  } catch (err) {
    console.error('[FX] Failed to refresh USD→NGN rate:', err.message);
    if (cachedRate) {
      // Serve stale data rather than fail — a rate that's a day or two
      // old is still far more useful than breaking checkout entirely.
      console.warn('[FX] Serving stale cached rate from', new Date(cachedRate.fetchedAt).toISOString());
      return cachedRate.rate;
    }
    console.warn('[FX] No cached rate available — using fixed fallback:', FALLBACK_USD_TO_NGN);
    return FALLBACK_USD_TO_NGN;
  }
}

/**
 * Converts a USD amount to whole naira (rounded — no kobo displayed
 * for subscription pricing).
 *
 * @param {number} usdAmount
 * @returns {Promise<number>}
 */
async function convertUsdToNgn(usdAmount) {
  const rate = await getUsdToNgnRate();
  return Math.round(usdAmount * rate);
}

/**
 * convertAmount
 * General-purpose currency converter between the two currencies this
 * app supports (NGN, USD) — built on top of the same cached
 * USD→NGN rate as everything else in this file, so every caller
 * across the codebase (Personal Wealth OS's accounts/income/expenses,
 * net worth totals, asset pricing, etc.) shares one single source of
 * truth for the exchange rate instead of each computing its own.
 *
 * Unlike convertUsdToNgn, this does NOT round — callers doing
 * intermediate math (e.g. adjusting an account balance) need the
 * unrounded value so small amounts don't get zeroed out or drift
 * from repeated rounding. Round only at final display time.
 *
 * @param {number} amount
 * @param {string} fromCurrency  'NGN' | 'USD'
 * @param {string} toCurrency    'NGN' | 'USD'
 * @returns {Promise<number>}
 */
async function convertAmount(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return amount;

  const rate = await getUsdToNgnRate();

  if (fromCurrency === 'USD' && toCurrency === 'NGN') return amount * rate;
  if (fromCurrency === 'NGN' && toCurrency === 'USD') return amount / rate;

  // Unsupported currency pair — return the amount unconverted rather
  // than silently producing a wrong number or throwing mid-transaction.
  console.warn(`[FX] convertAmount: unsupported currency pair ${fromCurrency} → ${toCurrency}, returning amount unconverted.`);
  return amount;
}

module.exports = { getUsdToNgnRate, convertUsdToNgn, convertAmount };
