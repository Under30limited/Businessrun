/**
 * scripts/setup-paystack-plans.js
 *
 * Creates the actual Paystack Plans for every paid tier, in both USD
 * and NGN, and writes the resulting plan codes (plus the NGN price
 * actually used) to config/paystack-plans.generated.json — which
 * config/plans.js reads at load time.
 *
 * RUN ONCE initially, and RE-RUN periodically to refresh the naira
 * price when the exchange rate has moved enough to matter (there's no
 * automatic re-pricing — Paystack Plans have a fixed amount, see
 * config/plans.js's header comment for why).
 *
 * Re-running this is SAFE for existing subscribers: it creates NEW
 * Paystack plan codes and overwrites the generated JSON file with
 * them, but does nothing to anyone already subscribed on the OLD plan
 * codes — they keep paying their original price until you separately
 * decide to migrate them (Paystack has no built-in way to reprice an
 * existing subscription; migrating means canceling the old
 * subscription and starting a new one on the new plan code).
 *
 * ── PARTIAL SUCCESS IS EXPECTED AND FINE ────────────────────────────
 * USD and NGN (and each tier) are set up INDEPENDENTLY — a failure on
 * one (e.g. your Paystack account not yet enabled for foreign-currency
 * transactions, which is an account-level setting on Paystack's side,
 * not something this script controls) does not block the others.
 * Whatever succeeds gets written; whatever doesn't is reported clearly
 * at the end so you know exactly what to fix and re-run. The app
 * itself already expects this — GET /api/plans reports a `payable`
 * flag per currency, and BillingPage.jsx shows "Coming Soon" for any
 * plan/currency combo that isn't set up yet, rather than breaking.
 *
 * Requires PAYSTACK_SECRET_KEY in .env.
 *
 * Run:
 *   node scripts/setup-paystack-plans.js
 */

'use strict';

require('dotenv').config();

const fs   = require('fs');
const path = require('path');

const { PAID_PLAN_IDS, PLANS } = require('../config/plans');
const { createPlan }            = require('../services/paystack.service');
const { convertUsdToNgn }       = require('../services/fx.service');

const OUTPUT_PATH = path.join(__dirname, '..', 'config', 'paystack-plans.generated.json');

/**
 * Attempts one currency's plan creation in isolation. Never throws —
 * returns null on failure so the caller can continue with everything
 * else regardless of what happened here.
 */
async function tryCreatePlan({ name, amount, currency }) {
  try {
    const created = await createPlan({ name, amount, currency, interval: 'monthly' });
    console.log(`  ✓ ${currency} plan created: ${created.plan_code}`);
    return created.plan_code;
  } catch (err) {
    console.error(`  ✗ ${currency} plan FAILED: ${err.message}`);
    return null;
  }
}

async function run() {
  console.log('Setting up Paystack Plans');
  console.log('================================================================================');

  const result   = {};
  const failures = [];

  for (const planId of PAID_PLAN_IDS) {
    const plan     = PLANS[planId];
    const priceNGN = await convertUsdToNgn(plan.priceUSD);

    console.log(`\n${plan.name}: $${plan.priceUSD} / ₦${priceNGN.toLocaleString()}`);

    const usdCode = await tryCreatePlan({
      name:     `${plan.name} (USD)`,
      amount:   Math.round(plan.priceUSD * 100), // cents
      currency: 'USD',
    });
    if (!usdCode) failures.push(`${planId} (USD)`);

    const ngnCode = await tryCreatePlan({
      name:     `${plan.name} (NGN)`,
      amount:   Math.round(priceNGN * 100), // kobo
      currency: 'NGN',
    });
    if (!ngnCode) failures.push(`${planId} (NGN)`);

    result[planId] = {
      usd:           usdCode,
      ngn:           ngnCode,
      priceNGNFixed: priceNGN,
    };
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2) + '\n');

  console.log('\n================================================================================');
  console.log(`Written to ${OUTPUT_PATH}`);

  const anySucceeded = Object.values(result).some(r => r.usd || r.ngn);

  if (failures.length > 0) {
    console.log(`\n⚠ ${failures.length} plan/currency combo(s) did NOT get set up: ${failures.join(', ')}`);
    console.log('These will show as "Coming Soon" on the Billing page until fixed and this script is re-run.');
    if (!anySucceeded) {
      console.error('\nNothing succeeded at all — exiting with an error so this is caught by any automation.');
      process.exit(1);
    }
  } else {
    console.log('\nAll plans created successfully.');
  }

  console.log('Restart the server (or redeploy) for config/plans.js to pick up the new codes.');
}

run().catch(err => {
  console.error('\nSetup FAILED unexpectedly:', err.message);
  process.exit(1);
});
