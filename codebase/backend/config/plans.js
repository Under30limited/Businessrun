/**
 * config/plans.js
 *
 * BusinessRun subscription tiers — defined as code, not stored
 * per-business in the database. br-subscriptions only ever stores
 * WHICH plan a business is on (planId); everything about what that
 * plan actually includes is looked up from here. This means changing
 * what a tier includes later is a one-line edit in this file, not a
 * migration across every existing subscriber.
 *
 * FEATURE KEYS must match the existing FEATURE_KEYS used by the team
 * permission system (middleware/permissions.js, team.controller.js) —
 * 'inventory' | 'sales' | 'daylog' | 'reports' | 'cfo' | 'advisor'.
 *
 * ── WHAT'S GATED HOW ────────────────────────────────────────────────
 * - `features`: a hard on/off gate, enforced by middleware/plan.js's
 *   requirePlan(featureKey) — same shape as requireFeature, but checks
 *   the BUSINESS's plan instead of a member's granted permissions.
 *   'sales' and 'daylog' are included on every tier (including Zero) —
 *   the pricing doc never restricts these, they're core day-to-day
 *   tools, not a tier differentiator.
 *   'advisor' is intentionally NOT gated here — it's always
 *   accessible at every tier; what varies is USAGE (see `limits`
 *   below), not access.
 *
 * - `limits`: usage caps, enforced at the point of the specific
 *   action (inventory item creation, advisor question count, team
 *   invite) rather than as a route-level gate. `null` means unlimited.
 *
 * ── PRICING: TWO SEPARATE NUMBERS, TWO SEPARATE PURPOSES ────────────
 * - DISPLAY price (pricing page, upgrade prompts): priceUSD here,
 *   converted to naira live via services/fx.service.js. Always
 *   current, never stale.
 * - ACTUAL CHARGE price: Paystack Plans have a FIXED amount set at
 *   creation time — a live per-transaction conversion is not
 *   possible with Paystack's plan-based recurring billing (the
 *   plan_code you pass to transaction/initialize overrides whatever
 *   amount you send). So `priceNGNFixed` below is the real, currently
 *   configured naira price actually charged — set by
 *   scripts/setup-paystack-plans.js, and only changes when that
 *   script is re-run (e.g. periodically, when the naira moves enough
 *   to matter). Existing subscribers stay on whatever plan_code they
 *   originally subscribed to; re-running the script creates NEW plan
 *   codes for NEW subscribers rather than silently repricing anyone
 *   already paying.
 *
 * paystack.plans.{monthly,annually}.{usd,ngn} are filled in by that
 * same script — null until it's been run at least once for a given
 * tier/currency/interval.
 *
 * ── YEARLY BILLING ───────────────────────────────────────────────
 * Same plan/tier, same features/limits — 'annually' is a second
 * BILLING INTERVAL on top of the existing three tiers, not a fourth
 * tier. priceUSDAnnualOriginal is always DERIVED (a plain 12x the
 * monthly price, rounded to 2dp) — never hand-typed — so it can't
 * silently drift out of sync with the monthly price. There is no
 * standing discount for choosing yearly on its own — the entire
 * yearly discount is whatever PROMO.discounts.annually currently is
 * (see PROMOTIONAL DISCOUNT below). Paystack's Plan objects support
 * 'annually' as a real interval value natively; this isn't 12 monthly
 * charges simulated some other way, it's a genuinely separate
 * recurring Plan, which is exactly why switching between monthly and
 * annually (or between tiers) means CANCELLING the old Paystack
 * subscription, not editing it in place — see controllers/payments.
 * controller.js's disableSubscription usage for why.
 *
 * ── PROMOTIONAL DISCOUNT (temporary — see PROMO below) ─────────────
 * priceUSD / priceUSDAnnual are, deliberately, THE CURRENT PRICE — 
 * i.e. already promo-discounted whenever PROMO.active is true. Every
 * downstream consumer (checkout amount in payments.controller.js,
 * the fraud-check that verifies what was actually charged, and
 * scripts/setup-paystack-plans.js which creates the real Paystack
 * Plan objects) reads directly from these two fields, so the discount
 * propagates everywhere automatically with no changes needed to any
 * of those files — they were already just "trust config/plans.js for
 * the real price," which is exactly the property that makes this
 * safe to bolt on. priceUSDOriginal / priceUSDAnnualOriginal hold the
 * pre-discount reference price, for strikethrough display only —
 * nothing charges against those two.
 *
 * To END the promotion: set PROMO.active to false, then re-run
 * scripts/setup-paystack-plans.js (creates fresh full-price Paystack
 * Plans) and redeploy. Existing subscribers who paid the discounted
 * price during the promo keep their existing plan_code and keep
 * paying that discounted price on renewal — ending the promo only
 * affects NEW checkouts from that point on, same principle as every
 * other plan_code change in this file.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// Generated by scripts/setup-paystack-plans.js — this file is DATA,
// never hand-edited. Re-running that script overwrites it with fresh
// plan codes / a fresh fixed NGN price. Kept separate from this file
// specifically so nothing needs to parse/rewrite JS source code —
// the script only ever touches a plain JSON file.
const GENERATED_PATH = path.join(__dirname, 'paystack-plans.generated.json');

function loadGenerated() {
  try {
    return JSON.parse(fs.readFileSync(GENERATED_PATH, 'utf8'));
  } catch {
    // Not run yet — every paid tier just has no Paystack plan code
    // until scripts/setup-paystack-plans.js has been run once.
    return { plus1: {}, plus2: {}, plus3: {} };
  }
}

const generated = loadGenerated();

// 12x the monthly price — the yearly option's reference price before
// any promotional discount. No standing "commit-to-yearly" discount
// baked in here anymore — yearly's ENTIRE current discount comes from
// PROMO.discounts.annually below. Kept as a named function (not just
// inlined at each plan) purely so it stays obviously in sync with
// whatever priceUSDOriginal is above it — change that and this
// follows automatically.
function annualUSDFor(monthlyUSD) {
  return Math.round(monthlyUSD * 12 * 100) / 100;
}

// ── PROMOTIONAL DISCOUNT ─────────────────────────────────────────
// Temporary — see this file's header for how to end it. This is
// currently the ENTIRE discount on the yearly price — there is no
// separate standing "commit-to-yearly" discount; priceUSDAnnualOriginal
// is a plain 12x the monthly price (see annualUSDFor above).
const PROMO = {
  active: true,
  discounts: {
    monthly:  0.50, // 50% off each plan's monthly price
    annually: 0.70, // 70% off each plan's (already-discounted) yearly price
  },
};

function applyPromo(basePrice, discount) {
  if (!PROMO.active) return basePrice;
  return Math.round(basePrice * (1 - discount) * 100) / 100;
}

function paystackFor(planId) {
  const g = generated[planId] || {};
  return {
    paystack: {
      plans: {
        monthly:  { usd: g.usd        || null, ngn: g.ngn        || null },
        annually: { usd: g.usdAnnual  || null, ngn: g.ngnAnnual  || null },
      },
    },
    priceNGNFixed:       g.priceNGNFixed       ?? null,
    priceNGNFixedAnnual: g.priceNGNFixedAnnual ?? null,
  };
}

const PLANS = {
  zero: {
    id:       'zero',
    name:     'BusinessRun Zero',
    tagline:  'Free',
    priceUSD: 0,
    priceUSDOriginal: 0,
    priceUSDAnnual: 0,
    priceUSDAnnualOriginal: 0,
    priceNGNFixed: 0,
    priceNGNFixedAnnual: 0,
    paystack: { plans: { monthly: { usd: null, ngn: null }, annually: { usd: null, ngn: null } } }, // Zero is never actually charged — no Paystack plan needed
    features: ['sales', 'daylog', 'inventory'],
    limits: {
      teamMembers:            1,     // admin (owner) only — no team invites at all
      inventoryItems:         25,
      advisorQuestionsPerDay: 5,
      advisorMemoryDays:      0,     // resets when the browser session ends
      languages:              ['English'],
    },
  },

  plus1: {
    id:       'plus1',
    name:     'BusinessRun +1',
    tagline:  'For a small team getting organised',
    priceUSDOriginal:       6.50,
    priceUSD:               applyPromo(6.50, PROMO.discounts.monthly),
    priceUSDAnnualOriginal: annualUSDFor(6.50),
    priceUSDAnnual:         applyPromo(annualUSDFor(6.50), PROMO.discounts.annually),
    ...paystackFor('plus1'),
    features: ['sales', 'daylog', 'inventory', 'reports', 'cfo'],
    limits: {
      teamMembers:            2,
      inventoryItems:         100,
      advisorQuestionsPerDay: 20,
      advisorMemoryDays:      30,
      languages:              ['English', 'Pidgin', 'Yoruba', 'Igbo', 'Hausa'],
    },
  },

  plus2: {
    id:       'plus2',
    name:     'BusinessRun +2',
    tagline:  'Custom reporting and team roles',
    priceUSDOriginal:       16.50,
    priceUSD:               applyPromo(16.50, PROMO.discounts.monthly),
    priceUSDAnnualOriginal: annualUSDFor(16.50),
    priceUSDAnnual:         applyPromo(annualUSDFor(16.50), PROMO.discounts.annually),
    ...paystackFor('plus2'),
    features: ['sales', 'daylog', 'inventory', 'reports', 'cfo'],
    limits: {
      teamMembers:            3,
      inventoryItems:         200,
      advisorQuestionsPerDay: null,  // unlimited
      advisorMemoryDays:      null,  // continuous
      languages:              ['English', 'Pidgin', 'Yoruba', 'Igbo', 'Hausa', 'French'],
    },
  },

  plus3: {
    id:       'plus3',
    name:     'BusinessRun +3',
    tagline:  'Everything, for a growing team',
    priceUSDOriginal:       26.50,
    priceUSD:               applyPromo(26.50, PROMO.discounts.monthly),
    priceUSDAnnualOriginal: annualUSDFor(26.50),
    priceUSDAnnual:         applyPromo(annualUSDFor(26.50), PROMO.discounts.annually),
    ...paystackFor('plus3'),
    features: ['sales', 'daylog', 'inventory', 'reports', 'cfo'],
    limits: {
      teamMembers:            5,
      inventoryItems:         null,  // unlimited
      advisorQuestionsPerDay: null,
      advisorMemoryDays:      null,
      languages:              ['English', 'Pidgin', 'Yoruba', 'Igbo', 'Hausa', 'French'],
    },
  },
};

// Every new business (and every already-live one, per the migration)
// starts here. One rule, no special-casing.
const TRIAL_PLAN_ID     = 'plus1';
const TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const FALLBACK_PLAN_ID  = 'zero'; // where a lapsed trial/subscription lands

// Valid billing cadences — 'annually' matches Paystack's own interval
// enum value exactly (not 'yearly'), used verbatim when creating Plans
// in scripts/setup-paystack-plans.js. UI-facing code can still label
// it "Yearly" for humans; the string itself stays 'annually' everywhere
// it touches Paystack or gets compared/stored.
const BILLING_INTERVALS        = ['monthly', 'annually'];
const DEFAULT_BILLING_INTERVAL = 'monthly';

// Ordered low → high, for "does plan X include at least tier Y" checks
// and for rendering an upgrade path in the UI.
const PLAN_ORDER = ['zero', 'plus1', 'plus2', 'plus3'];

// Paid tiers only — the ones a business can actually be charged for.
const PAID_PLAN_IDS = ['plus1', 'plus2', 'plus3'];

function getPlan(planId) {
  return PLANS[planId] || PLANS[FALLBACK_PLAN_ID];
}

/**
 * getPlanByPaystackCode
 * Reverse lookup — given a Paystack plan_code from a webhook payload
 * (or a transaction/verify response), find which of our plans, which
 * currency, AND which billing interval it corresponds to. Used by the
 * webhook handlers and verify() to figure out what to actually apply
 * — including whether a renewal should extend by a month or a year,
 * since each interval is a genuinely separate Paystack Plan object
 * with its own code (see this file's YEARLY BILLING comment above).
 *
 * @param {string} paystackPlanCode
 * @returns {{ planId: string, currency: 'USD'|'NGN', interval: 'monthly'|'annually' } | null}
 */
function getPlanByPaystackCode(paystackPlanCode) {
  if (!paystackPlanCode) return null;
  for (const planId of PAID_PLAN_IDS) {
    for (const interval of ['monthly', 'annually']) {
      const { usd, ngn } = PLANS[planId].paystack.plans[interval];
      if (usd === paystackPlanCode) return { planId, currency: 'USD', interval };
      if (ngn === paystackPlanCode) return { planId, currency: 'NGN', interval };
    }
  }
  return null;
}

module.exports = {
  PLANS, PLAN_ORDER, PAID_PLAN_IDS,
  TRIAL_PLAN_ID, TRIAL_DURATION_MS, FALLBACK_PLAN_ID,
  BILLING_INTERVALS, DEFAULT_BILLING_INTERVAL,
  PROMO,
  getPlan, getPlanByPaystackCode,
};
