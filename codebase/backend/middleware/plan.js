/**
 * middleware/plan.js
 *
 * Subscription-plan enforcement — a different axis from
 * middleware/permissions.js's requireFeature:
 *
 *   requireFeature(key)  — does the OWNER'S GRANT let this specific
 *                          team member use this feature? Owners
 *                          always pass; only matters for members.
 *
 *   requirePlan(key)     — does the BUSINESS'S PLAN include this
 *                          feature at all? Blocks EVERYONE, owner
 *                          included — being the owner no longer means
 *                          unlimited access once plans exist.
 *
 * Both checks are independent and BOTH must pass. Route files stack
 * them in this order:
 *
 *   router.use(protect);
 *   router.use(requireTeamSeatEntitlement);  // is a member even allowed on this plan at all?
 *   router.use(requirePlan('cfo'));          // does the plan include this feature?
 *   router.use(requireFeature('cfo'));       // has the owner granted THIS member access?
 *
 * requirePlan is skipped entirely for features included on every
 * tier (sales, daylog, inventory) — there's nothing to gate there.
 */

'use strict';

const ApiError       = require('../utils/ApiError');
const asyncHandler    = require('../utils/asyncHandler');
const { getEffectivePlan } = require('../services/subscription.service');

/**
 * requirePlan
 * Blocks the request unless the business's CURRENT effective plan
 * (trial-expiry-aware — see subscription.service.js) includes this
 * feature. Applies to owners and members alike.
 *
 * @param {string} featureKey  'reports' | 'cfo' (the only plan-gated
 *                               features today — sales/daylog/inventory
 *                               are on every tier, advisor is usage-
 *                               limited rather than feature-gated)
 */
function requirePlan(featureKey) {
  return asyncHandler(async (req, res, next) => {
    const { plan } = await getEffectivePlan(req.user.uid); // uid = businessUid

    if (!plan.features.includes(featureKey)) {
      throw ApiError.forbidden(
        `Your current plan (${plan.name}) doesn't include this feature. Upgrade to unlock it.`
      );
    }

    next();
  });
}

/**
 * requireTeamSeatEntitlement
 * A team member's very first gate on every team-accessible route —
 * before even checking which specific features they're granted,
 * confirm the business's plan supports team members AT ALL right now.
 *
 * BusinessRun Zero is 1 user (owner only) — a business that lapsed
 * back to Zero effectively has no room for a second user, so a member
 * is blocked outright rather than allowed through with zero granted
 * features (which would be a confusing half-broken experience instead
 * of a clear one).
 *
 * Owners always pass — this only ever applies to req.user.role === 'member'.
 *
 * Deliberately does NOT check the exact current member COUNT against
 * the plan's seat limit here — only whether the plan supports team
 * members at all (limit >= 2). A business that downgrades from a
 * higher tier while still having more active members than the new
 * tier's exact seat count is not retroactively locked out — same
 * "grandfather existing, restrict only new additions" policy already
 * used for inventory item caps. The exact seat count is enforced at
 * INVITE time instead (team.controller.js), not at access time.
 */
const requireTeamSeatEntitlement = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'member') return next(); // owners always pass, any plan

  const { plan } = await getEffectivePlan(req.user.uid);

  if (plan.limits.teamMembers < 2) {
    throw ApiError.forbidden(
      "This business's current plan does not support team member access. Ask the business owner to renew their subscription."
    );
  }

  next();
});

module.exports = { requirePlan, requireTeamSeatEntitlement };
