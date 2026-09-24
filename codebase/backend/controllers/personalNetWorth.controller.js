/**
 * controllers/personalNetWorth.controller.js
 *
 * The "Net Worth & Cash Flow" tab's backend — replaces Digital CFO's
 * role for Personal Wealth OS. Three endpoints:
 *
 *   GET /api/personal/networth          — current totals, computed live
 *   GET /api/personal/networth/history  — real historical trend
 *   GET /api/personal/networth/cashflow — this month's income vs
 *                                          expenses, savings rate, burn
 *
 * ── FORMULA (confirmed against the reference prototype) ───────────
 *   netWorth = liquidCash (Accounts)
 *            + manualAssetValue (Assets — excluding market-tracked,
 *              see below)
 *            + owedToMe (unsettled Debts, type: owed_to_me)
 *            - owedByMe (unsettled Debts, type: i_owe)
 *
 * ── MARKET-TRACKED ASSETS ─────────────────────────────────────────
 * Crypto/stock assets ARE included in every total below, priced live
 * via services/marketData.service.js (cached — see that file for the
 * caching/staleness/failure-handling rules). If a price is genuinely
 * unavailable (never cached, and the live fetch just failed), that
 * one asset contributes 0 to the total and is counted in
 * `unpricedAssetCount` — so the frontend can say "N assets not
 * counted — price unavailable" rather than silently understate net
 * worth with no explanation.
 *
 * ── NO FABRICATED TRENDS ──────────────────────────────────────────
 * The reference prototype hardcoded "+2.9% MoM" and "+18.4% vs Last
 * Month" as static strings — never computed from anything. Neither
 * appears here. Any month-over-month or trend figure in this
 * controller is computed from real stored data (net worth snapshots,
 * or this month's actual logged transactions) and is explicitly null
 * — not a guess, not zero — when there isn't enough history yet to
 * compute it honestly.
 *
 * ── SNAPSHOT MECHANISM ─────────────────────────────────────────────
 * No cron job. Whenever GET /networth is called, if today's snapshot
 * (br-personalNetWorthSnapshots, keyed by date) doesn't exist yet, one
 * is written on the spot from the totals just computed — same lazy-
 * computation approach already used elsewhere in this codebase (e.g.
 * trial expiry). Snapshots are always stored in NGN (the canonical
 * currency — see personal.service.js's table-layout comment) so a
 * trend stays comparable across days even if the user's display
 * currency toggle changes.
 */

'use strict';

const asyncHandler = require('../utils/asyncHandler');
const personalService = require('../services/personal.service');
const marketDataService = require('../services/marketData.service');
const { convertAmount } = require('../config/currencies');
const { CURRENCIES, DISCRETIONARY_EXPENSE_CATEGORIES, ASSET_CATEGORIES } = require('../config/personalOptions');

/**
 * makeConverter
 * Returns a plain synchronous converter function, built on the
 * static multi-currency table in config/currencies.js (all 13
 * supported currencies, not just NGN/USD). Kept as its own function
 * (rather than every call site importing convertAmount directly) so
 * this file's callers — and personalAdvisor.controller.js, which
 * reuses it — don't need to change if the underlying conversion
 * mechanism ever changes again.
 *
 * Historically this fetched a live USD/NGN rate once per request and
 * closed over it (hence the `.rate` property and the optional
 * pass-through argument some callers still use below) — now that
 * conversion is a static table lookup there's no per-request fetch to
 * amortize, but the signature is left unchanged so nothing calling
 * this needs to be touched.
 */
async function makeConverter() {
  const convert = function (amount, from, to) {
    return convertAmount(amount, from, to);
  };
  convert.rate = null; // no longer meaningful — see comment above
  return convert;
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function isThisCalendarMonth(dateStr, refDate) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d.getUTCFullYear() === refDate.getUTCFullYear() && d.getUTCMonth() === refDate.getUTCMonth();
}

// ── Core aggregation — shared by /networth and the lazy snapshot ────
async function computeTotals(personalUid, convert, displayCurrency) {
  const [accounts, assets, debts] = await Promise.all([
    personalService.getAccounts(personalUid),
    personalService.getAssets(personalUid),
    personalService.getDebts(personalUid),
  ]);

  const liquidCash = accounts.reduce((sum, a) => sum + convert(a.balance, a.currency, displayCurrency), 0);

  const manualAssets = assets.filter(a => !a.isMarketTracked);
  const marketAssets = assets.filter(a => a.isMarketTracked);

  const assetsByCategory = {};
  for (const cat of ASSET_CATEGORIES) assetsByCategory[cat] = 0;
  let totalAssetsValue = 0;

  for (const asset of manualAssets) {
    // NOT multiplied by quantity — for a manual asset, estimatedValue
    // is what the person entered as the TOTAL worth of that entry
    // (e.g. "this pair of laptops is worth ₦800k"), not a per-unit
    // price. quantity × per-unit-price only applies to market-tracked
    // assets, handled separately just below.
    const value = convert(asset.estimatedValue || 0, asset.currency, displayCurrency);
    assetsByCategory[asset.category] = (assetsByCategory[asset.category] || 0) + value;
    totalAssetsValue += value;
  }

  // Market-tracked assets — priced live (cached) via
  // marketData.service.js, which always returns a USD price;
  // `convert` (already built from this request's own rate) handles
  // turning that into the requested display currency.
  let unpricedAssetCount = 0;
  if (marketAssets.length > 0) {
    const priceMap = await marketDataService.getAssetPrices(
      marketAssets.map(a => ({ marketAssetType: a.marketAssetType, symbol: a.marketSymbol }))
    );

    for (const asset of marketAssets) {
      const key = marketDataService.cacheKey(asset.marketAssetType, asset.marketSymbol);
      const priceInfo = priceMap[key];

      if (!priceInfo || priceInfo.price === null) {
        // Genuinely unavailable — contributes 0, counted explicitly
        // rather than silently missing from the total with no trace.
        unpricedAssetCount += 1;
        continue;
      }

      const valueUSD = priceInfo.price * (asset.quantity || 1);
      const valueInDisplayCurrency = convert(valueUSD, 'USD', displayCurrency);

      assetsByCategory[asset.category] = (assetsByCategory[asset.category] || 0) + valueInDisplayCurrency;
      totalAssetsValue += valueInDisplayCurrency;
    }
  }

  let owedToMe = 0;
  let owedByMe = 0;
  for (const debt of debts) {
    if (debt.isSettled) continue;
    const remaining = Math.max(0, debt.amount - (debt.paidAmount || 0));
    const converted = convert(remaining, debt.currency, displayCurrency);
    if (debt.type === 'owed_to_me') owedToMe += converted;
    else owedByMe += converted;
  }

  const netWorth = liquidCash + totalAssetsValue + owedToMe - owedByMe;

  return {
    liquidCash, totalAssetsValue, assetsByCategory, owedToMe, owedByMe, netWorth,
    unpricedAssetCount,
    accountCount: accounts.length,
    assetCount:   assets.length,
  };
}

// ── GET /api/personal/networth ──────────────────────────────────────
const getNetWorth = asyncHandler(async (req, res) => {
  // ?currency= lets a screen ask for one-off totals in a currency
  // other than the space's own preference (used by the currency
  // switcher in the dashboard header — see WealthDashboard.jsx —
  // to preview a total before committing it as the new default via
  // PATCH /api/personal/profile). Falls back to the space's saved
  // displayCurrency, and only to the hardcoded 'NGN' default if
  // even that is somehow missing (e.g. a pre-migration record).
  const space = await personalService.getPersonalSpace(req.user.personalUid);
  const displayCurrency = CURRENCIES.includes(req.query.currency)
    ? req.query.currency
    : (space?.displayCurrency || 'NGN');
  const convert = await makeConverter();

  const totals = await computeTotals(req.user.personalUid, convert, displayCurrency);

  // ── Lazy snapshot — always in NGN regardless of what was requested ──
  const today = todayDateString();
  const existingSnapshot = await personalService.getSnapshot(req.user.personalUid, today);
  if (!existingSnapshot) {
    const ngnTotals = displayCurrency === 'NGN'
      ? totals
      : await computeTotals(req.user.personalUid, await makeConverter(convert.rate), 'NGN');
    await personalService.saveSnapshot(req.user.personalUid, today, {
      totalAssets:      ngnTotals.liquidCash + ngnTotals.totalAssetsValue,
      totalLiabilities: ngnTotals.owedByMe,
      netWorth:         ngnTotals.netWorth,
    }).catch(err => console.error('[NetWorth] Failed to save daily snapshot:', err.message));
  }

  // ── Emergency runway — liquid cash ÷ this month's essential burn ───
  // Uses REAL logged expenses for the current month, not an average or
  // an assumption. Null (not 0, not infinite) when there's nothing to
  // divide by yet — an honest "not enough data" rather than a number.
  const expenses = await personalService.getExpenses(req.user.personalUid);
  const now = new Date();
  const essentialThisMonth = expenses
    .filter(e => isThisCalendarMonth(e.date, now) && !DISCRETIONARY_EXPENSE_CATEGORIES.includes(e.category))
    .reduce((sum, e) => sum + convert(e.amount, e.currency, displayCurrency), 0);

  const emergencyRunwayMonths = essentialThisMonth > 0
    ? Math.round((totals.liquidCash / essentialThisMonth) * 10) / 10
    : null;

  res.json({
    success: true,
    currency: displayCurrency,
    ...totals,
    emergencyRunwayMonths,
  });
});

// ── GET /api/personal/networth/history ──────────────────────────────
const getNetWorthHistory = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 90, 365);
  const snapshots = await personalService.getSnapshotHistory(req.user.personalUid, limit);

  // Real month-over-month change, only when there's genuinely enough
  // history to compute it — otherwise null, never a guess.
  let momChangePercent = null;
  if (snapshots.length >= 2) {
    const first = snapshots[0];
    const last  = snapshots[snapshots.length - 1];
    if (first.netWorth !== 0) {
      momChangePercent = Math.round(((last.netWorth - first.netWorth) / Math.abs(first.netWorth)) * 1000) / 10;
    }
  }

  res.json({
    success: true,
    snapshots, // always in NGN — see this file's header
    momChangePercent,
    hasEnoughHistory: snapshots.length >= 2,
  });
});

// ── GET /api/personal/networth/cashflow ─────────────────────────────
const getCashFlow = asyncHandler(async (req, res) => {
  const space = await personalService.getPersonalSpace(req.user.personalUid);
  const displayCurrency = CURRENCIES.includes(req.query.currency)
    ? req.query.currency
    : (space?.displayCurrency || 'NGN');
  const convert = await makeConverter();
  const now = new Date();

  const [incomeStreams, expenses] = await Promise.all([
    personalService.getIncomeStreams(req.user.personalUid),
    personalService.getExpenses(req.user.personalUid),
  ]);

  const incomeThisMonth = incomeStreams.filter(i => isThisCalendarMonth(i.dateReceived, now));
  const expensesThisMonth = expenses.filter(e => isThisCalendarMonth(e.date, now));

  const totalIncome = incomeThisMonth.reduce((sum, i) => sum + convert(i.amount, i.currency, displayCurrency), 0);
  const totalExpenses = expensesThisMonth.reduce((sum, e) => sum + convert(e.amount, e.currency, displayCurrency), 0);

  const expensesByCategory = {};
  let discretionarySpend = 0;
  let essentialSpend = 0;
  for (const e of expensesThisMonth) {
    const converted = convert(e.amount, e.currency, displayCurrency);
    expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + converted;
    if (DISCRETIONARY_EXPENSE_CATEGORIES.includes(e.category)) discretionarySpend += converted;
    else essentialSpend += converted;
  }

  // Savings rate — null (not 0%) when there's no income to divide by,
  // same "honest absence over a misleading number" principle as above.
  const savingsRatePercent = totalIncome > 0
    ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 1000) / 10
    : null;

  // Envelope spending pool — remaining balance across every active
  // envelope, exactly as tracked (not time-filtered — an envelope is a
  // specific deposit being drawn down, not a monthly-resetting budget).
  const activeEnvelopes = incomeStreams.filter(s => s.isEnvelope);
  const spendingPoolRemaining = activeEnvelopes.reduce(
    (sum, s) => sum + convert(Math.max(0, s.amount - (s.amountSpent || 0)), s.currency, displayCurrency), 0
  );
  const spendingPoolAllocated = activeEnvelopes.reduce(
    (sum, s) => sum + convert(s.amount, s.currency, displayCurrency), 0
  );

  res.json({
    success: true,
    currency: displayCurrency,
    month: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`,
    totalIncome,
    totalExpenses,
    savingsRatePercent,
    discretionarySpend,
    essentialSpend,
    expensesByCategory,
    spendingPoolRemaining,
    spendingPoolAllocated,
    activeEnvelopeCount: activeEnvelopes.length,
  });
});

module.exports = {
  getNetWorth, getNetWorthHistory, getCashFlow,
  // Exported for reuse by controllers/personalAdvisor.controller.js —
  // the Wealth Advisor injects real net worth totals into its context,
  // and should never compute that math a second, potentially-drifting
  // way. Same reasoning as gemini.service.js sharing callGemini.
  computeTotals, makeConverter,
};
