/**
 * controllers/personalAssets.controller.js
 *
 * Physical & financial holdings — six categories (see config/
 * personalOptions.js), only ONE of which (Crypto & Equities) is
 * market-tracked (live-priced via services/marketData.service.js)
 * rather than manually valued.
 *
 * Routes:
 *   GET    /api/personal/assets       — list all assets (computes live value for market-tracked ones)
 *   POST   /api/personal/assets       — create an asset
 *   PATCH  /api/personal/assets/:id   — update an asset
 *   DELETE /api/personal/assets/:id   — delete an asset
 */

'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError      = require('../utils/ApiError');
const { sanitise, requireFields } = require('../utils/sanitise');
const personalService = require('../services/personal.service');
const marketDataService = require('../services/marketData.service');
const { convertAmount } = require('../config/currencies');
const {
  ASSET_CATEGORIES, MARKET_TRACKED_ASSET_CATEGORIES, LIQUIDITY_LEVELS, CURRENCIES,
} = require('../config/personalOptions');

// ── GET /api/personal/assets ─────────────────────────────────────────
const getAssets = asyncHandler(async (req, res) => {
  const assets = await personalService.getAssets(req.user.personalUid);

  const marketTracked = assets.filter(a => a.isMarketTracked);
  const priceMap = marketTracked.length > 0
    ? await marketDataService.getAssetPrices(
        marketTracked.map(a => ({ marketAssetType: a.marketAssetType, symbol: a.marketSymbol }))
      )
    : {};

  const annotated = assets.map((a) => {
    if (!a.isMarketTracked) return a;

    const key = marketDataService.cacheKey(a.marketAssetType, a.marketSymbol);
    const priceInfo = priceMap[key];

    if (!priceInfo || priceInfo.price === null) {
      // No usable price at all yet — never substitute 0 or guess.
      return { ...a, estimatedValue: null, priceUnavailable: true, priceError: priceInfo?.error || 'No price data yet.' };
    }

    // Market data comes back in USD only (see marketData.service.js)
    // — converted here (via the same static multi-currency table
    // used everywhere else, not a hand-rolled NGN-only calculation)
    // so an asset stored/displayed in any of the 13 supported
    // currencies still gets a correct estimatedValue, not a raw USD
    // figure mislabeled.
    const valueUSD = priceInfo.price * (a.quantity || 1);
    const estimatedValue = convertAmount(valueUSD, 'USD', a.currency);

    return {
      ...a,
      estimatedValue,
      priceStale:   priceInfo.isStale,
      priceAsOf:    priceInfo.fetchedAt,
      priceUnavailable: false,
    };
  });

  res.json({ success: true, assets: annotated });
});

// ── POST /api/personal/assets ────────────────────────────────────────
const createAsset = asyncHandler(async (req, res) => {
  const body = sanitise(req.body, [
    'name', 'category', 'estimatedValue', 'currency', 'purchasePrice', 'purchaseCurrency',
    'quantity', 'serialNumber', 'liquidity', 'notes', 'location',
    'isMarketTracked', 'marketSymbol', 'marketAssetType',
  ]);
  requireFields(body, ['name', 'category', 'currency']);

  if (!ASSET_CATEGORIES.includes(body.category)) {
    throw ApiError.badRequest(`Invalid asset category: "${body.category}".`);
  }
  if (!CURRENCIES.includes(body.currency)) {
    throw ApiError.badRequest(`Invalid currency: "${body.currency}".`);
  }
  if (body.liquidity && !LIQUIDITY_LEVELS.includes(body.liquidity)) {
    throw ApiError.badRequest(`Invalid liquidity level: "${body.liquidity}".`);
  }

  const isMarketTracked = MARKET_TRACKED_ASSET_CATEGORIES.includes(body.category) && Boolean(body.isMarketTracked);
  if (isMarketTracked) {
    if (!body.marketSymbol || !body.marketAssetType) {
      throw ApiError.badRequest('A market-tracked asset needs both a symbol and a market type (crypto or stock).');
    }
    if (!['crypto', 'stock'].includes(body.marketAssetType)) {
      throw ApiError.badRequest('marketAssetType must be "crypto" or "stock".');
    }
  } else if (typeof body.estimatedValue !== 'number' || body.estimatedValue < 0) {
    throw ApiError.badRequest('estimatedValue must be a non-negative number for a manually-valued asset.');
  }

  const asset = await personalService.createAsset(req.user.personalUid, { ...body, isMarketTracked });
  res.status(201).json({ success: true, asset });
});

// ── PATCH /api/personal/assets/:id ───────────────────────────────────
const updateAsset = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const body = sanitise(req.body, [
    'name', 'estimatedValue', 'quantity', 'serialNumber', 'liquidity', 'notes', 'location',
  ]);

  if (body.liquidity && !LIQUIDITY_LEVELS.includes(body.liquidity)) {
    throw ApiError.badRequest(`Invalid liquidity level: "${body.liquidity}".`);
  }

  const existing = await personalService.getAsset(req.user.personalUid, id);
  if (!existing) throw ApiError.badRequest('Asset not found.');

  if (existing.isMarketTracked && body.estimatedValue !== undefined) {
    // A market-tracked asset's value is computed, not entered — allow
    // quantity edits (changes what the live price gets multiplied by)
    // but never a direct value override that a future price refresh
    // would just silently discard anyway.
    throw ApiError.badRequest('estimatedValue is computed for a market-tracked asset — edit quantity instead.');
  }

  await personalService.updateAsset(req.user.personalUid, id, body);
  res.json({ success: true });
});

// ── DELETE /api/personal/assets/:id ──────────────────────────────────
const deleteAsset = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await personalService.getAsset(req.user.personalUid, id);
  if (!existing) throw ApiError.badRequest('Asset not found.');

  await personalService.deleteAsset(req.user.personalUid, id);
  res.json({ success: true });
});

module.exports = { getAssets, createAsset, updateAsset, deleteAsset };
