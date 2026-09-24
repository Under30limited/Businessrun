/**
 * services/paystack.service.js
 *
 * Thin wrapper around Paystack's REST API. Four responsibilities:
 *   1. Create Plans (used only by scripts/setup-paystack-plans.js)
 *   2. Initialize a transaction against a plan_code (starts a subscription)
 *   3. Disable a subscription (used when a business switches plan/interval —
 *      see controllers/payments.controller.js's switch-handling)
 *   4. Verify a webhook's signature
 *
 * ── SIGNATURE VERIFICATION — READ BEFORE TOUCHING THIS ──────────────
 * Paystack signs webhook deliveries with HMAC **SHA-512** (not the more
 * common SHA-256) of the **raw, unparsed request body**, sent in the
 * `x-paystack-signature` header. The raw-body requirement is the part
 * most integrations get wrong: re-serializing the already-JSON-parsed
 * body with JSON.stringify() before hashing can produce different
 * bytes than what Paystack originally sent (key order, whitespace),
 * causing valid webhooks to fail verification. This is why index.js's
 * express.json() middleware is configured with a `verify` callback
 * that stashes the exact raw bytes on `req.rawBody` — verifyWebhookSignature
 * below MUST be called with that raw buffer, never with
 * JSON.stringify(req.body).
 *
 * Comparison is done with crypto.timingSafeEqual (constant-time) —
 * a plain === comparison on a signature is a timing side-channel.
 */

'use strict';

const crypto = require('crypto');

const PAYSTACK_BASE_URL   = 'https://api.paystack.co';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

function authHeaders() {
  if (!PAYSTACK_SECRET_KEY) {
    throw new Error('[Paystack] PAYSTACK_SECRET_KEY is not set.');
  }
  return {
    'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
    'Content-Type':  'application/json',
  };
}

async function paystackRequest(method, endpoint, body) {
  const res = await fetch(`${PAYSTACK_BASE_URL}${endpoint}`, {
    method,
    headers: authHeaders(),
    body:    body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok || data.status === false) {
    throw new Error(`[Paystack] ${method} ${endpoint} failed: ${data.message || res.status}`);
  }

  return data.data; // Paystack wraps every response in { status, message, data }
}

/**
 * createPlan
 * Used only by scripts/setup-paystack-plans.js — not called at
 * runtime by the app itself.
 *
 * @param {Object} opts
 * @param {string} opts.name
 * @param {number} opts.amount     In the currency's SMALLEST unit
 *                                  (kobo for NGN, cents for USD) — i.e.
 *                                  already multiplied by 100.
 * @param {string} opts.currency   'USD' | 'NGN'
 * @param {string} [opts.interval] Defaults to 'monthly'
 * @returns {Promise<{ plan_code: string }>}
 */
async function createPlan({ name, amount, currency, interval = 'monthly' }) {
  return paystackRequest('POST', '/plan', { name, amount, currency, interval });
}

/**
 * initializeTransaction
 * Starts a subscription checkout — passing `plan` overrides whatever
 * amount is sent with the plan's own configured price (Paystack's
 * behavior, not ours — see config/plans.js's header comment).
 *
 * @param {Object} opts
 * @param {string} opts.email
 * @param {string} opts.planCode
 * @param {number} opts.amount        In the currency's smallest unit
 *                                     (kobo/cents) — same value the
 *                                     Plan itself was created with.
 *                                     Paystack validates this is a
 *                                     real positive number even though
 *                                     the plan's own configured amount
 *                                     is what actually governs the
 *                                     recurring charge.
 * @param {string} opts.callbackUrl
 * @param {string} opts.reference     Our own unique reference, so we
 *                                     can look this transaction up
 *                                     later without depending on
 *                                     Paystack's id.
 * @param {Object} opts.metadata      Echoed back on the FIRST charge's
 *                                     webhook — NOT guaranteed on later
 *                                     renewal charges, which is why the
 *                                     webhook handler also falls back
 *                                     to looking up by customer/plan
 *                                     code (see controllers/payments.controller.js).
 * @returns {Promise<{ authorization_url: string, access_code: string, reference: string }>}
 */
async function initializeTransaction({ email, planCode, amount, callbackUrl, reference, metadata }) {
  return paystackRequest('POST', '/transaction/initialize', {
    email,
    plan:         planCode,
    amount,
    callback_url: callbackUrl,
    reference,
    metadata,
  });
}

/**
 * disableSubscription
 * Cancels a Paystack subscription so it stops auto-renewing/charging.
 * Used when a business SWITCHES plan or billing interval — each
 * combination is a genuinely separate Paystack Plan object (see
 * config/plans.js's YEARLY BILLING comment), so picking a new one
 * never modifies the old subscription in place; the old one keeps
 * charging forever unless explicitly disabled.
 *
 * Paystack requires BOTH the subscription_code and its matching
 * email_token (not the customer's email address) — both are only
 * ever delivered via the subscription.create webhook event, which is
 * why they're captured and stored on the subscription row at that
 * point rather than derived some other way. Idempotent in practice —
 * disabling an already-disabled subscription returns an error from
 * Paystack that callers should treat as non-fatal (see
 * controllers/payments.controller.js).
 *
 * @param {string} subscriptionCode
 * @param {string} emailToken
 * @returns {Promise<Object>}
 */
async function disableSubscription(subscriptionCode, emailToken) {
  return paystackRequest('POST', '/subscription/disable', {
    code:  subscriptionCode,
    token: emailToken,
  });
}

/**
 * verifyWebhookSignature
 * @param {Buffer} rawBody    req.rawBody — the exact bytes Paystack sent,
 *                             NOT a re-serialized/parsed version.
 * @param {string} signature  req.headers['x-paystack-signature']
 * @returns {boolean}
 */
function verifyWebhookSignature(rawBody, signature) {
  if (!PAYSTACK_SECRET_KEY || !rawBody || !signature) return false;

  const expected = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf    = Buffer.from(signature, 'hex');

  // timingSafeEqual throws if lengths differ rather than returning
  // false — guard that first.
  if (expectedBuf.length !== actualBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * verifyTransaction
 * Confirms the definitive status of a transaction — must be called
 * server-side only (never expose the secret key to the frontend).
 * Idempotent — safe to call more than once for the same reference.
 *
 * @param {string} reference
 * @returns {Promise<Object>}  data.status is 'success' | 'abandoned' | 'failed' | ...
 */
async function verifyTransaction(reference) {
  return paystackRequest('GET', `/transaction/verify/${encodeURIComponent(reference)}`);
}

module.exports = { createPlan, initializeTransaction, disableSubscription, verifyTransaction, verifyWebhookSignature };
