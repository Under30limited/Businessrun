/**
 * services/marketData.service.js
 *
 * Live pricing for market-tracked Assets (crypto via CoinGecko, stocks
 * via Finnhub — see the build discussion for why these two providers).
 * Deliberately isolated from both db.service.js and personal.service.js
 * (own DynamoDB client) — same independence principle applied
 * throughout this module, and specifically useful here because a
 * provider swap (e.g. replacing Finnhub later for better foreign-
 * market coverage) should only ever touch this one file.
 *
 * ── CACHING — WHY AND HOW ────────────────────────────────────────
 * Prices are cached in br-marketPriceCache for CACHE_TTL_MS (10
 * minutes) before a fresh fetch is attempted again. Without this, N
 * users each holding the same coin/stock would trigger N live API
 * calls every time anyone's Assets tab or Net Worth total loads —
 * burns through Finnhub's free-tier rate limit fast, and CoinGecko's
 * public tier isn't unlimited either. A cache keyed by symbol (not by
 * user) means the SAME cached price serves every user holding that
 * same asset.
 *
 * ── FAILURE HANDLING — NEVER A FABRICATED NUMBER ──────────────────
 * If a live fetch fails (network issue, invalid symbol, rate limit),
 * this NEVER invents a price. It falls back to the last successfully
 * cached price, explicitly flagged `isStale: true` — or, if nothing
 * has ever been cached for that symbol, returns `price: null` with an
 * `error` message. Every caller (personalAssets.controller.js,
 * personalNetWorth.controller.js) must treat `price: null` as "no
 * value available," never as zero.
 *
 * Cache key format: `${marketAssetType}:${symbol}` — e.g.
 * "crypto:bitcoin" (CoinGecko's own coin id, NOT a ticker like "BTC" —
 * tickers collide across coins), "stock:AAPL". Namespacing by type
 * this way means a crypto id and a stock ticker can never collide
 * even if they happened to be the same string.
 */

'use strict';

const {
  DynamoDBClient,
} = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} = require('@aws-sdk/lib-dynamodb');

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const ddbClient = new DynamoDBClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const dynamo = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions:   { removeUndefinedValues: true },
  unmarshallOptions: { wrapNumbers: false },
});

const CACHE_TABLE   = 'br-marketPriceCache';
const CACHE_TTL_MS  = 10 * 60 * 1000; // 10 minutes

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const FINNHUB_BASE_URL   = 'https://finnhub.io/api/v1';
const FINNHUB_API_KEY    = process.env.FINNHUB_API_KEY;

function cacheKey(marketAssetType, symbol) {
  return `${marketAssetType}:${symbol}`;
}

// ── Cache read/write ─────────────────────────────────────────────

async function getCachedEntry(key) {
  const result = await dynamo.send(new GetCommand({
    TableName: CACHE_TABLE,
    Key:       { symbol: key },
  }));
  return result.Item || null;
}

async function setCachedEntry(key, price, currency) {
  await dynamo.send(new PutCommand({
    TableName: CACHE_TABLE,
    Item: {
      symbol:    key,
      price,
      currency,
      fetchedAt: new Date().toISOString(),
    },
  }));
}

function isFresh(entry) {
  if (!entry) return false;
  const age = Date.now() - new Date(entry.fetchedAt).getTime();
  return age < CACHE_TTL_MS;
}

// ── Live provider calls ──────────────────────────────────────────

/**
 * fetchCryptoPriceLive
 * CoinGecko's simple price endpoint — public, no API key. `id` must
 * be CoinGecko's own coin id (e.g. "bitcoin", "ethereum"), not a
 * ticker symbol.
 */
async function fetchCryptoPriceLive(id) {
  const url = `${COINGECKO_BASE_URL}/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CoinGecko returned HTTP ${res.status}`);
  }
  const data = await res.json();
  const price = data?.[id]?.usd;
  if (typeof price !== 'number') {
    throw new Error(`CoinGecko has no USD price for coin id "${id}" — check the id is correct (not a ticker).`);
  }
  return price; // USD
}

/**
 * fetchStockPriceLive
 * Finnhub's quote endpoint. `c` in the response is the current price.
 * Requires FINNHUB_API_KEY in .env.
 */
async function fetchStockPriceLive(ticker) {
  if (!FINNHUB_API_KEY) {
    throw new Error('[MarketData] FINNHUB_API_KEY is not set.');
  }
  const url = `${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(ticker)}&token=${FINNHUB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Finnhub returned HTTP ${res.status}`);
  }
  const data = await res.json();
  if (typeof data?.c !== 'number' || data.c === 0) {
    throw new Error(`Finnhub has no quote for ticker "${ticker}" — check the ticker is correct and traded on a covered exchange.`);
  }
  return data.c; // USD
}

// ── Public API ────────────────────────────────────────────────────

/**
 * getAssetPrice
 * The one function callers should use. Returns:
 *   { price: number|null, currency: 'USD'|null, fetchedAt: string|null,
 *     isStale: boolean, error?: string }
 *
 * price is null ONLY when there is truly no usable value at all
 * (never been cached, and the live fetch just failed) — callers must
 * treat that as "unavailable," never substitute 0.
 *
 * @param {'crypto'|'stock'} marketAssetType
 * @param {string} symbol  CoinGecko coin id for crypto, ticker for stock
 */
async function getAssetPrice(marketAssetType, symbol) {
  const key = cacheKey(marketAssetType, symbol);
  const cached = await getCachedEntry(key);

  if (isFresh(cached)) {
    return { price: cached.price, currency: cached.currency, fetchedAt: cached.fetchedAt, isStale: false };
  }

  try {
    const price = marketAssetType === 'crypto'
      ? await fetchCryptoPriceLive(symbol)
      : await fetchStockPriceLive(symbol);

    await setCachedEntry(key, price, 'USD');
    return { price, currency: 'USD', fetchedAt: new Date().toISOString(), isStale: false };
  } catch (err) {
    console.error(`[MarketData] Live fetch failed for ${key}:`, err.message);

    if (cached) {
      // Serve the last known value rather than nothing — clearly
      // flagged as stale, never presented as current.
      return { price: cached.price, currency: cached.currency, fetchedAt: cached.fetchedAt, isStale: true, error: err.message };
    }

    return { price: null, currency: null, fetchedAt: null, isStale: true, error: err.message };
  }
}

/**
 * getAssetPrices
 * Batch helper — fetches/caches multiple symbols in parallel (used by
 * personalAssets.controller.js and personalNetWorth.controller.js,
 * which each may need several market-tracked assets' prices per
 * request). Each entry keyed by `${marketAssetType}:${symbol}` so
 * callers can look their own results back up unambiguously.
 *
 * @param {Array<{marketAssetType: 'crypto'|'stock', symbol: string}>} items
 * @returns {Promise<Object>} map of cacheKey -> getAssetPrice() result
 */
async function getAssetPrices(items) {
  const uniqueItems = Array.from(
    new Map(items.map(i => [cacheKey(i.marketAssetType, i.symbol), i])).values()
  );

  const results = await Promise.all(
    uniqueItems.map(async (i) => [cacheKey(i.marketAssetType, i.symbol), await getAssetPrice(i.marketAssetType, i.symbol)])
  );

  return Object.fromEntries(results);
}

module.exports = { getAssetPrice, getAssetPrices, cacheKey };
