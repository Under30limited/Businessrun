/**
 * controllers/payments.controller.js
 *
 * POST /api/payments/initialize  — owner starts a checkout for a plan
 * POST /api/payments/webhook     — Paystack calls this on every event
 * GET  /api/payments/verify/:reference — post-checkout confirmation
 *
 * ── WHY OWNER-ONLY ────────────────────────────────────────────────
 * Per how this was scoped: only the business owner can renew/change
 * a subscription — a team member only ever sees an informational
 * "ask your owner" prompt, never a real payment action.
 *
 * ── WEBHOOK IDENTIFICATION STRATEGY ─────────────────────────────────
 * The FIRST charge (from /initialize) carries OUR metadata
 * ({ businessUid, planId, currency }) reliably, because it's the same
 * request/response cycle we control. Paystack does not clearly
 * guarantee that metadata survives onto later, subscription-driven
 * renewal charges — so every event handler tries metadata.businessUid
 * FIRST, and falls back to looking up the business by
 * paystackCustomerCode (via a GSI) if metadata is missing. The
 * customer code itself is captured and stored on the very first
 * event (subscription.create), so the fallback path is always
 * available from the second charge onward.
 *
 * ── VERIFY TRUST MODEL ────────────────────────────────────────────
 * GET /verify/:reference is reachable without a live login session
 * (Paystack's hosted checkout can take several minutes — long enough
 * to outlast an already-near-expiry cookie), but it must NOT become
 * an anonymous oracle: knowing a reference string (which can end up
 * in browser history, a forwarded email, a shared screenshot) should
 * not be enough on its own to read someone else's payment status or
 * repeatedly re-trigger their subscription's renewal date.
 *
 * So it trusts exactly one of two things, in this priority order:
 *   1. A valid `br_pmt_token` cookie bound to THIS exact reference —
 *      minted server-side in initialize() at checkout start, entirely
 *      separate from the login session, 1-hour lifetime, single-use
 *      (cleared once consumed). Proves "this browser is the one that
 *      started this specific checkout" without depending on the
 *      unrelated login session surviving the whole flow.
 *   2. A valid login session (req.user) — the original mechanism,
 *      still works for anyone whose session happened to survive.
 * If NEITHER is present, the endpoint declines to call Paystack at
 * all and asks the caller to log in — see verify() below.
 *
 * ── BILLING INTERVALS & SWITCHING PLANS ─────────────────────────────
 * 'monthly' and 'annually' are each a genuinely separate Paystack Plan
 * object per tier (config/plans.js) — Paystack has no concept of "the
 * same plan, billed differently." So every place that extends
 * currentPeriodEnd resolves WHICH interval actually applies from the
 * plan_code that was actually charged (getPlanByPaystackCode), not
 * from an assumption — see periodEndFor() below.
 *
 * A business "switching" plan or interval is just a normal new
 * checkout through initialize()/verify() — same as subscribing for
 * the first time. The one extra step: if they already had an active
 * Paystack subscription, it needs to be CANCELED once the new one is
 * confirmed, or they'd be billed on both forever. That cancellation
 * needs the old subscription's subscription_code AND email_token —
 * Paystack only ever delivers both together via the subscription.
 * create webhook event, never via transaction/verify — so the
 * cancel-old-subscription step lives ONLY in handleSubscriptionCreate
 * below, not in verify(). verify() still applies the new plan/period
 * immediately for fast UI feedback; the old subscription's
 * cancellation follows a beat later when the webhook arrives, same as
 * paystackSubscriptionCode capture already worked before this feature.
 */

'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError      = require('../utils/ApiError');
const { sanitise, requireFields } = require('../utils/sanitise');
const db             = require('../services/db.service');
const paystack       = require('../services/paystack.service');
const { PLANS, getPlanByPaystackCode, BILLING_INTERVALS, DEFAULT_BILLING_INTERVAL } = require('../config/plans');
const { v4: uuidv4 } = require('uuid');
const {
  signPaymentToken, verifyPaymentToken,
  PAYMENT_COOKIE_NAME, PAYMENT_COOKIE_OPTIONS, PAYMENT_COOKIE_CLEAR_OPTIONS,
} = require('../utils/jwt');

const APP_URL = process.env.APP_URL || 'https://thebusinessrun.com';

// ── POST /api/payments/initialize ───────────────────────────────────
const initialize = asyncHandler(async (req, res) => {
  if (req.user.role === 'member') {
    throw ApiError.forbidden('Only the business owner can manage billing. Ask them to renew or change the plan.');
  }

  const body = sanitise(req.body, ['planId', 'currency', 'interval']);
  requireFields(body, ['planId', 'currency']);

  const plan = PLANS[body.planId];
  if (!plan || body.planId === 'zero') {
    throw ApiError.badRequest('Invalid plan.');
  }

  const currency = body.currency.toUpperCase();
  if (!['USD', 'NGN'].includes(currency)) {
    throw ApiError.badRequest('currency must be USD or NGN.');
  }

  const interval = body.interval || DEFAULT_BILLING_INTERVAL;
  if (!BILLING_INTERVALS.includes(interval)) {
    throw ApiError.badRequest(`interval must be one of: ${BILLING_INTERVALS.join(', ')}.`);
  }

  const planCode = plan.paystack.plans[interval][currency === 'USD' ? 'usd' : 'ngn'];
  if (!planCode) {
    throw ApiError.badRequest(
      `${plan.name} (${currency}, ${interval}) isn't set up for payment yet — run scripts/setup-paystack-plans.js first.`
    );
  }

  const reference = `br_${req.user.uid}_${Date.now()}_${uuidv4().slice(0, 8)}`;

  // Paystack's /transaction/initialize validates that `amount` is a
  // real positive number even when `plan` is present — the plan's own
  // configured amount is still what actually governs the recurring
  // charge, but the request itself is rejected ("Invalid Amount Sent")
  // without a properly-formatted amount alongside it. Computed exactly
  // the same way scripts/setup-paystack-plans.js computed it when the
  // Plan was created, so the two always agree.
  const amount = interval === 'annually'
    ? (currency === 'USD' ? Math.round(plan.priceUSDAnnual * 100) : Math.round((plan.priceNGNFixedAnnual || 0) * 100))
    : (currency === 'USD' ? Math.round(plan.priceUSD * 100)       : Math.round((plan.priceNGNFixed || 0) * 100));

  const transaction = await paystack.initializeTransaction({
    email:       req.user.email,
    planCode,
    amount,
    callbackUrl: `${APP_URL}/billing/callback`,
    reference,
    metadata: {
      businessUid: req.user.uid,
      planId:      body.planId,
      currency,
      interval,
    },
  });

  // Mint the short-lived payment-confirmation token bound to THIS
  // exact reference + business, and set it as its own cookie — see
  // utils/jwt.js and this file's header for why it's separate from
  // the login session. This is what lets verify() succeed later even
  // if the login cookie itself expires during checkout.
  res.cookie(
    PAYMENT_COOKIE_NAME,
    signPaymentToken(transaction.reference, req.user.uid),
    PAYMENT_COOKIE_OPTIONS
  );

  res.json({
    success:          true,
    authorizationUrl: transaction.authorization_url,
    reference:         transaction.reference,
  });
});

// ── Webhook helpers ──────────────────────────────────────────────────

/**
 * resolveBusinessUid
 * Metadata first (reliable on the first charge), customer-code GSI
 * fallback (for renewals where metadata may be absent).
 */
async function resolveBusinessUid(data) {
  const metaBusinessUid = data?.metadata?.businessUid;
  if (metaBusinessUid) return metaBusinessUid;

  const customerCode = data?.customer?.customer_code;
  if (customerCode) {
    const subscription = await db.getSubscriptionByPaystackCustomerCode(customerCode);
    if (subscription) return subscription.businessUid;
  }

  return null;
}

function addOneMonth(fromISO) {
  const d = new Date(fromISO || Date.now());
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
}

function addOneYear(fromISO) {
  const d = new Date(fromISO || Date.now());
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString();
}

/**
 * periodEndFor
 * Single place every renewal-date calculation goes through, so
 * 'monthly' vs 'annually' can never silently diverge between the
 * webhook handlers and verify().
 */
function periodEndFor(interval, fromISO) {
  return interval === 'annually' ? addOneYear(fromISO) : addOneMonth(fromISO);
}

/**
 * expectedAmountFor
 * The real amount (smallest currency unit) a plan/currency/interval
 * combo should have been charged — same computation initialize() and
 * scripts/setup-paystack-plans.js both use, so a verify()/webhook
 * fraud-check can compare against it exactly.
 */
function expectedAmountFor(plan, currency, interval) {
  if (interval === 'annually') {
    return currency === 'USD'
      ? Math.round(plan.priceUSDAnnual * 100)
      : Math.round((plan.priceNGNFixedAnnual || 0) * 100);
  }
  return currency === 'USD'
    ? Math.round(plan.priceUSD * 100)
    : Math.round((plan.priceNGNFixed || 0) * 100);
}

/**
 * cancelPreviousSubscriptionIfSwitching
 * Called from handleSubscriptionCreate ONLY (see this file's header —
 * subscription_code + email_token are only ever delivered together
 * via that webhook event). If the business already had a DIFFERENT
 * active Paystack subscription before this one, cancels it so they
 * are never billed on both. Best-effort and non-fatal by design: a
 * failure here means manual cleanup may be needed, but must never
 * block the NEW subscription (the one the founder is actively paying
 * for right now) from being activated.
 *
 * @param {Object|null} previousSub   the subscription row as it was
 *                                     BEFORE this event's update was
 *                                     applied — pass null/undefined if
 *                                     there was nothing to compare
 * @param {string} newSubscriptionCode
 */
async function cancelPreviousSubscriptionIfSwitching(previousSub, newSubscriptionCode) {
  const oldCode  = previousSub?.paystackSubscriptionCode;
  const oldToken = previousSub?.paystackEmailToken;

  if (!oldCode || !oldToken || oldCode === newSubscriptionCode) {
    // Nothing to cancel: either this is the business's first-ever
    // subscription, we're missing what we'd need to cancel it safely
    // (an older subscription created before this feature existed
    // would have no stored email_token — left alone rather than
    // guessed at), or it's the exact same subscription renewing
    // normally, not a switch.
    return;
  }

  try {
    await paystack.disableSubscription(oldCode, oldToken);
    console.log(`[Paystack webhook] Canceled previous subscription ${oldCode} (switched to ${newSubscriptionCode})`);
  } catch (err) {
    // Non-fatal — logged for manual follow-up. Common benign cause:
    // the old subscription was already disabled (e.g. this event
    // firing twice) — Paystack errors on a repeat disable call.
    console.error(`[Paystack webhook] Could not cancel previous subscription ${oldCode}:`, err.message);
  }
}

// ── Event handlers ────────────────────────────────────────────────────

async function handleSubscriptionCreate(data) {
  const businessUid = await resolveBusinessUid(data);
  if (!businessUid) {
    console.error('[Paystack webhook] subscription.create: could not resolve businessUid', data?.customer?.customer_code);
    return;
  }

  const match    = getPlanByPaystackCode(data.plan?.plan_code);
  const interval = match?.interval || data?.metadata?.interval || DEFAULT_BILLING_INTERVAL;

  // Capture what the business was on BEFORE this update, so a switch
  // (different plan and/or interval than before) can cancel the old
  // Paystack subscription right after — see
  // cancelPreviousSubscriptionIfSwitching's own docs for why this is
  // the only place that can safely do this.
  const previousSub = await db.getSubscription(businessUid);

  await db.updateSubscription(businessUid, {
    planId:                   match?.planId || data?.metadata?.planId || 'plus1',
    status:                   'active',
    currentPeriodEnd:         data.next_payment_date || periodEndFor(interval),
    paystackCustomerCode:     data.customer?.customer_code || null,
    paystackSubscriptionCode: data.subscription_code || null,
    paystackEmailToken:       data.email_token || null,
    billingInterval:          interval,
    currency:                 match?.currency || data?.metadata?.currency || null,
  });

  console.log(`[Paystack webhook] subscription.create → business ${businessUid} is now active on ${match?.planId || data?.metadata?.planId} (${interval})`);

  await cancelPreviousSubscriptionIfSwitching(previousSub, data.subscription_code);
}

async function handleChargeSuccess(data) {
  const businessUid = await resolveBusinessUid(data);
  if (!businessUid) {
    console.error('[Paystack webhook] charge.success: could not resolve businessUid', data?.customer?.customer_code);
    return;
  }

  // Resolve which interval this renewal actually belongs to — try the
  // plan_code on THIS event first (most reliable when present), fall
  // back to whatever the business's subscription row already has on
  // file (set the first time they subscribed/switched), and only
  // default to 'monthly' if neither tells us anything. Getting this
  // wrong in the 'annually' direction would under-extend a yearly
  // subscriber's access down to a single month.
  const match = getPlanByPaystackCode(data.plan?.plan_code);
  let interval = match?.interval;
  if (!interval) {
    const existingSub = await db.getSubscription(businessUid);
    interval = existingSub?.billingInterval || DEFAULT_BILLING_INTERVAL;
  }

  // A charge not tied to a subscription (shouldn't normally happen
  // for our flow, since every checkout goes through a plan_code) —
  // still safe to just extend the period defensively.
  await db.updateSubscription(businessUid, {
    status:               'active',
    currentPeriodEnd:     periodEndFor(interval),
    paystackCustomerCode: data.customer?.customer_code || undefined,
  });

  console.log(`[Paystack webhook] charge.success → business ${businessUid} period extended (${interval})`);
}

async function handlePaymentFailed(data) {
  const businessUid = await resolveBusinessUid(data);
  if (!businessUid) {
    console.error('[Paystack webhook] payment failed: could not resolve businessUid', data?.customer?.customer_code);
    return;
  }

  await db.updateSubscription(businessUid, { status: 'past_due' });
  console.log(`[Paystack webhook] payment failed → business ${businessUid} marked past_due`);
}

async function handleSubscriptionDisable(data) {
  const businessUid = await resolveBusinessUid(data);
  if (!businessUid) {
    console.error('[Paystack webhook] subscription.disable: could not resolve businessUid', data?.customer?.customer_code);
    return;
  }

  await db.updateSubscription(businessUid, { status: 'canceled' });
  console.log(`[Paystack webhook] subscription.disable → business ${businessUid} marked canceled`);
}

// ── POST /api/payments/webhook ──────────────────────────────────────
/**
 * No auth — Paystack calls this directly. Security comes entirely
 * from signature verification, not from a session/cookie.
 *
 * Must return 200 quickly (Paystack retries on anything else, and
 * on timeouts) — every handler above is a small, fast DynamoDB write,
 * so processing inline before responding is fine at this scale.
 */
const webhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-paystack-signature'];

  if (!paystack.verifyWebhookSignature(req.rawBody, signature)) {
    console.error('[Paystack webhook] Invalid signature — rejecting.');
    return res.status(401).json({ success: false });
  }

  const { event, data } = req.body;

  try {
    switch (event) {
      case 'subscription.create':
        await handleSubscriptionCreate(data);
        break;
      case 'charge.success':
        await handleChargeSuccess(data);
        break;
      case 'invoice.payment_failed':
      case 'charge.failed':
        await handlePaymentFailed(data);
        break;
      case 'subscription.disable':
      case 'subscription.not_renew':
        await handleSubscriptionDisable(data);
        break;
      default:
        console.log(`[Paystack webhook] Unhandled event type: ${event}`);
    }
  } catch (err) {
    // Log but still return 200 — Paystack will retry a non-200
    // response for up to 72 hours, which would just repeat this same
    // failure. A logged error here is something for us to look into
    // manually, not something Paystack retrying helps with.
    console.error(`[Paystack webhook] Error processing "${event}":`, err.message);
  }

  res.status(200).json({ success: true });
});

// ── GET /api/payments/verify/:reference ───────────────────────────
/**
 * Called by the billing callback page right after Paystack redirects
 * the browser back — gives the user INSTANT feedback rather than
 * making them guess while the webhook processes asynchronously in
 * the background. The webhook remains authoritative and applies the
 * same update independently regardless of whether this call ever
 * happens — this is a faster, redundant confirmation for THIS
 * checkout, not a replacement for it.
 *
 * TRUST MODEL — see this file's header for the full reasoning. In
 * short: a valid `br_pmt_token` cookie bound to this exact reference
 * (minted in initialize(), 1-hour lifetime, single-use) is checked
 * FIRST; a live login session (req.user) is the fallback; if NEITHER
 * is present, this declines to call Paystack or reveal anything at
 * all, rather than acting as an anonymous lookup for any reference
 * string someone happens to have.
 *
 * Two fraud-prevention checks before trusting a Paystack "success",
 * per Paystack's own guidance: (1) if we know both who's asking AND
 * whose payment this was, they must match; (2) the amount actually
 * charged must match what the plan costs — "status: success" alone
 * is not sufficient to grant value.
 */
const verify = asyncHandler(async (req, res) => {
  const { reference } = req.params;
  if (!reference) throw ApiError.badRequest('Missing transaction reference.');

  const paymentToken = verifyPaymentToken(req.cookies?.[PAYMENT_COOKIE_NAME]);
  const tokenMatchesThisReference = Boolean(paymentToken && paymentToken.reference === reference);

  // Neither a session NOR a matching payment token — decline outright.
  // No Paystack call, no status/plan details revealed. A stranger who
  // merely has this reference string (browser history, a forwarded
  // link, a shared screenshot) gets nothing from this endpoint; the
  // webhook remains the guaranteed path for this business's own
  // upgrade regardless.
  if (!req.user && !tokenMatchesThisReference) {
    return res.json({
      success:       true,
      paymentStatus: 'unknown',
      requiresLogin: true,
      message:       'Please log in to view this payment.',
    });
  }

  if (req.user && req.user.role === 'member') {
    throw ApiError.forbidden('Only the business owner can manage billing.');
  }

  const result = await paystack.verifyTransaction(reference);

  if (result.status !== 'success') {
    return res.json({
      success:       true,
      paymentStatus: result.status, // 'abandoned' | 'failed' | 'pending' | ...
      message:       'This payment was not completed successfully.',
    });
  }

  const metaBusinessUid = result.metadata?.businessUid;

  // Fraud check 1 — skipped when the payment token already matched
  // this exact reference (that IS the proof of ownership, minted
  // server-side at checkout start — stronger than comparing two
  // strings). Otherwise falls back to the session-based comparison.
  if (!tokenMatchesThisReference && req.user && metaBusinessUid && metaBusinessUid !== req.user.uid) {
    throw ApiError.forbidden('This transaction does not belong to your business.');
  }

  // Which business actually gets upgraded — the payment token's
  // businessUid first (bound to this one reference, can't be reused
  // for any other), then Paystack's own metadata, then the session.
  const targetBusinessUid = (tokenMatchesThisReference && paymentToken.businessUid)
    || metaBusinessUid
    || req.user?.uid;
  if (!targetBusinessUid) {
    throw ApiError.badRequest(
      `Could not determine which business this payment belongs to. If you were charged, contact support with this reference: ${reference}`
    );
  }

  const match = getPlanByPaystackCode(result.plan?.plan_code);
  const planId = match?.planId || result.metadata?.planId;
  const plan   = planId ? PLANS[planId] : null;

  // Which interval this specific transaction was actually charged
  // for — the plan_code Paystack actually charged is authoritative;
  // our own metadata (set at initialize()) is the fallback for the
  // rare case a code lookup somehow misses.
  const interval = match?.interval || result.metadata?.interval || DEFAULT_BILLING_INTERVAL;

  // Fraud check 2 — amount actually charged must match the plan's
  // real price for THIS interval (Paystack sends amounts in the
  // smallest currency unit — kobo for NGN, cents for USD — same
  // convention used when the plans were created in
  // scripts/setup-paystack-plans.js). Getting the interval wrong here
  // would either wrongly reject a legitimate annual payment (checked
  // against the monthly price) or wrongly accept an underpayment.
  if (plan) {
    const currency       = match?.currency || result.metadata?.currency;
    const expectedAmount = expectedAmountFor(plan, currency, interval);

    if (expectedAmount > 0 && result.amount !== expectedAmount) {
      console.error(
        `[Payments] Amount mismatch for ${reference}: expected ${expectedAmount}, got ${result.amount}`
      );
      throw ApiError.badRequest('Payment amount does not match the expected plan price.');
    }
  }

  // Idempotency guard — defense in depth so a repeat call for the
  // SAME reference (webhook + verify both firing, a stale tab
  // retrying, a cookie somehow surviving to be replayed) never
  // extends currentPeriodEnd more than once off of it.
  const currentSub     = await db.getSubscription(targetBusinessUid);
  const alreadyApplied = currentSub?.lastAppliedReference === reference;

  if (!alreadyApplied) {
    await db.updateSubscription(targetBusinessUid, {
      ...(planId ? { planId } : {}),
      status:               'active',
      currentPeriodEnd:     periodEndFor(interval),
      paystackCustomerCode: result.customer?.customer_code || undefined,
      currency:             match?.currency || result.metadata?.currency || undefined,
      billingInterval:      interval,
      lastAppliedReference: reference,
    });
  }

  // Single-use — clear the payment cookie now that it's served its
  // purpose, so the exact same browser can't silently replay it later
  // (e.g. via back/forward cache) even within its 1-hour window.
  if (tokenMatchesThisReference) {
    res.clearCookie(PAYMENT_COOKIE_NAME, PAYMENT_COOKIE_CLEAR_OPTIONS);
  }

  res.json({
    success:       true,
    paymentStatus: 'success',
    planName:      plan?.name || null,
    interval,
    // Lets the frontend know whether the browser's own LOGIN session
    // is still valid — if not, the upgrade is applied and safe, but
    // the UI won't reflect it until the founder logs back in.
    sessionValid:  Boolean(req.user) || tokenMatchesThisReference,
  });
});

module.exports = { initialize, webhook, verify };
