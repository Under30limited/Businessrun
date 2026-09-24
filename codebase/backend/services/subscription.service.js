/**
 * services/subscription.service.js
 *
 * The single place that answers "what plan is this business actually
 * on right now" — used by every enforcement point (middleware/plan.js,
 * team.controller.js's seat check, and later the usage-counter and
 * frontend-facing endpoints).
 *
 * ── WHY THIS IS LAZY, NOT CRON-DRIVEN ────────────────────────────────
 * Nothing actively flips a business from 'trialing' to 'active'/'zero'
 * the moment its trial or billing period ends — there's no scheduled
 * job required for correctness. Instead, every check here compares
 * the stored dates (trialEndsAt / currentPeriodEnd) against the
 * current time on each request. This means enforcement is correct
 * the INSTANT a trial or period lapses, without needing a cron job to
 * have already run and without a race condition where a cron job
 * hasn't caught up yet. A background job MAY still be added later to
 * proactively update `status` for reporting/admin-dashboard purposes,
 * but it is never required for enforcement to be correct.
 */

'use strict';

const db = require('./db.service');
const { getPlan, FALLBACK_PLAN_ID } = require('../config/plans');

/**
 * getEffectivePlan
 *
 * @param {string} businessUid
 * @returns {Promise<{
 *   subscription: Object|null,  // the raw br-subscriptions row, or null if missing entirely
 *   planId:       string,        // the plan actually in effect right now
 *   plan:         Object,        // full plan definition from config/plans.js
 *   expired:      boolean,       // true if a trial/period lapsed and we fell back
 * }>}
 */
async function getEffectivePlan(businessUid) {
  const subscription = await db.getSubscription(businessUid);

  // No subscription row at all — shouldn't happen once the migration
  // has run, but fail to the most restrictive plan rather than crash
  // or silently allow everything through.
  if (!subscription) {
    console.warn(`[Subscription] No subscription row for business ${businessUid} — falling back to ${FALLBACK_PLAN_ID}.`);
    return { subscription: null, planId: FALLBACK_PLAN_ID, plan: getPlan(FALLBACK_PLAN_ID), expired: true };
  }

  const now = Date.now();

  if (subscription.status === 'trialing') {
    const trialEndsAt = new Date(subscription.trialEndsAt).getTime();
    if (now > trialEndsAt) {
      return { subscription, planId: FALLBACK_PLAN_ID, plan: getPlan(FALLBACK_PLAN_ID), expired: true };
    }
    return { subscription, planId: subscription.planId, plan: getPlan(subscription.planId), expired: false };
  }

  if (subscription.status === 'active') {
    const periodEnd = new Date(subscription.currentPeriodEnd).getTime();
    if (now > periodEnd) {
      // Still marked 'active' in our records but the period has
      // technically lapsed with no renewal webhook received yet —
      // treat as expired defensively rather than trust a possibly-
      // stale status field.
      return { subscription, planId: FALLBACK_PLAN_ID, plan: getPlan(FALLBACK_PLAN_ID), expired: true };
    }
    return { subscription, planId: subscription.planId, plan: getPlan(subscription.planId), expired: false };
  }

  // 'past_due' or 'canceled' — always the fallback plan, regardless
  // of any stored dates.
  return { subscription, planId: FALLBACK_PLAN_ID, plan: getPlan(FALLBACK_PLAN_ID), expired: true };
}

/**
 * getSubscriptionSummary
 * The frontend-facing shape — used by getMe AND by login/select-
 * business/switch-business, so this info is available immediately
 * after signing in rather than requiring a separate /me call first.
 *
 * @param {string} businessUid
 * @param {string} role  'owner' | 'member' — determines teamAccessBlocked
 * @returns {Promise<{ subscription: Object, teamAccessBlocked: boolean }>}
 */
async function getSubscriptionSummary(businessUid, role) {
  const { subscription: raw, plan, expired } = await getEffectivePlan(businessUid);

  const relevantEndDate = raw?.status === 'trialing' ? raw.trialEndsAt : raw?.currentPeriodEnd;
  const daysRemaining    = relevantEndDate
    ? Math.max(0, Math.ceil((new Date(relevantEndDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;

  const subscription = {
    planId:           plan.id,
    planName:         plan.name,
    status:           raw?.status || 'zero',
    billingInterval:  raw?.billingInterval || null, // 'monthly' | 'annually' | null (Zero/trial — nothing billed yet)
    trialEndsAt:      raw?.trialEndsAt || null,
    currentPeriodEnd: raw?.currentPeriodEnd || null,
    daysRemaining,
    // A "renew soon" nudge only makes sense for a trial winding down
    // or a paid plan approaching its next charge — not for a business
    // permanently parked on Zero with nothing to renew.
    isApproachingEnd: daysRemaining !== null && daysRemaining <= 3 && plan.id !== 'zero',
    expired,
    features:         plan.features,
    limits:           plan.limits,
  };

  const teamAccessBlocked = role === 'member' && plan.limits.teamMembers < 2;

  return { subscription, teamAccessBlocked };
}

module.exports = { getEffectivePlan, getSubscriptionSummary };
