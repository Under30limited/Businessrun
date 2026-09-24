/**
 * controllers/plans.controller.js
 *
 * GET /api/plans — public, no auth required. Returns every plan
 * definition with freshly-computed NGN display prices (monthly AND
 * annual), so the frontend never hardcodes pricing or duplicates
 * conversion logic.
 *
 * Note the distinction (see config/plans.js's header comment):
 *   priceNGNDisplay(Annual) — live, via services/fx.service.js, changes daily
 *   priceNGNFixed(Annual)   — what's ACTUALLY charged, fixed until
 *                             scripts/setup-paystack-plans.js is re-run
 * These will usually be close but not always identical — that's
 * expected and fine; the fixed price is what the customer is
 * literally being billed, the display price is just today's estimate
 * for browsing.
 *
 * ── PROMOTIONAL DISCOUNT ─────────────────────────────────────────
 * priceUSD(Annual) / priceNGNDisplay(Annual) / priceNGNFixed(Annual)
 * are always THE CURRENT PRICE — already discounted whenever
 * config/plans.js's PROMO.active is true, since that's baked in at
 * the source. priceUSD(Annual)Original and priceNGNDisplay(Annual)
 * Original are the pre-discount reference, for strikethrough display
 * only — see promo.active below for whether to show them at all.
 */

'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { PLANS, PLAN_ORDER, PROMO } = require('../config/plans');
const { convertUsdToNgn }    = require('../services/fx.service');

const getPlans = asyncHandler(async (req, res) => {
  const plans = await Promise.all(
    PLAN_ORDER.map(async (planId) => {
      const plan = PLANS[planId];
      return {
        id:                     plan.id,
        name:                   plan.name,
        tagline:                plan.tagline,
        priceUSD:               plan.priceUSD,
        priceUSDOriginal:       plan.priceUSDOriginal,
        priceUSDAnnual:         plan.priceUSDAnnual,
        priceUSDAnnualOriginal: plan.priceUSDAnnualOriginal,
        priceNGNDisplay:               plan.priceUSD               > 0 ? await convertUsdToNgn(plan.priceUSD)               : 0,
        priceNGNDisplayOriginal:       plan.priceUSDOriginal       > 0 ? await convertUsdToNgn(plan.priceUSDOriginal)       : 0,
        priceNGNDisplayAnnual:         plan.priceUSDAnnual         > 0 ? await convertUsdToNgn(plan.priceUSDAnnual)         : 0,
        priceNGNDisplayAnnualOriginal: plan.priceUSDAnnualOriginal > 0 ? await convertUsdToNgn(plan.priceUSDAnnualOriginal) : 0,
        priceNGNFixed:          plan.priceNGNFixed,
        priceNGNFixedAnnual:    plan.priceNGNFixedAnnual,
        features:               plan.features,
        limits:                 plan.limits,
        // Whether this tier can actually be paid for yet — false until
        // scripts/setup-paystack-plans.js has been run for that
        // specific currency/interval combo.
        payable: {
          monthly: {
            usd: Boolean(plan.paystack?.plans?.monthly?.usd),
            ngn: Boolean(plan.paystack?.plans?.monthly?.ngn),
          },
          annually: {
            usd: Boolean(plan.paystack?.plans?.annually?.usd),
            ngn: Boolean(plan.paystack?.plans?.annually?.ngn),
          },
        },
      };
    })
  );

  res.json({
    success: true,
    plans,
    // Single source of truth for the discount percentages so the
    // frontend never hardcodes "50%"/"70%" — if config/plans.js's
    // PROMO changes, this response changes with it automatically.
    promo: {
      active: PROMO.active,
      discountPercent: {
        monthly:  Math.round(PROMO.discounts.monthly  * 100),
        annually: Math.round(PROMO.discounts.annually * 100),
      },
    },
  });
});

module.exports = { getPlans };
