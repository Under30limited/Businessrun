/**
 * middleware/permissions.js
 *
 * Gates a dashboard route to a specific feature key. Owners of the
 * CURRENT business (req.user.role === 'owner') always pass — they
 * have unrestricted access to their own business data. Team members
 * must have the feature in their permissions list AND still be active
 * on THIS specific business.
 *
 * ── WHY A LIVE DB CHECK, NOT JUST THE JWT ──────────────────────────
 * Permissions are embedded in the JWT at login for convenience, but
 * the cookie lives for 7 days (see utils/jwt.js COOKIE_OPTIONS). If
 * an owner revokes a member's access, that must take effect on their
 * very next request — not up to 7 days later when the token expires.
 * So this middleware re-reads the specific membership row on every
 * request. It's a single DynamoDB GetItem by primary key
 * (identityUid, businessUid) — cheap — and it's only paid by team
 * members, never by owners, since owners skip straight through
 * without a DB call.
 *
 * ── WHY (identityUid, businessUid), NOT req.user.uid ───────────────
 * Under the multi-tenant model, one identity can have memberships in
 * several businesses at once, each with its own role and permissions.
 * req.user.uid is the CURRENT business's scope (businessUid) — the
 * membership that actually governs this request is the one for
 * (req.user.identityUid, req.user.businessUid), not a lookup by
 * identity alone.
 * ─────────────────────────────────────────────────────────────────
 *
 * USAGE (in a route file, right after router.use(protect)):
 *
 *   const { requireFeature } = require('../middleware/permissions');
 *   router.use(requireFeature('sales'));
 */

'use strict';

const ApiError      = require('../utils/ApiError');
const asyncHandler   = require('../utils/asyncHandler');
const db             = require('../services/db.service');

/**
 * @param {string} featureKey  One of: 'inventory' | 'sales' | 'daylog' |
 *                              'reports' | 'cfo' | 'advisor'
 */
function requireFeature(featureKey) {
  return asyncHandler(async (req, res, next) => {
    // Owner of the current business — no DB round-trip needed, this
    // is the common case (and true whether or not this identity also
    // has OTHER memberships elsewhere; role is scoped to THIS token).
    if (req.user.role !== 'member') {
      return next();
    }

    // Member — re-check live, for the specific (identity, business)
    // pair this session is scoped to.
    const membership = await db.getMembership(req.user.identityUid, req.user.businessUid);

    if (!membership) {
      throw ApiError.forbidden('Your access could not be verified. Please log in again.');
    }

    if (membership.status === 'revoked') {
      throw ApiError.forbidden('Your access to this business has been revoked.');
    }

    if (membership.status !== 'active') {
      throw ApiError.forbidden('Your invite has not been accepted yet.');
    }

    const permissions = membership.permissions || [];
    if (!permissions.includes(featureKey)) {
      throw ApiError.forbidden(`You don't have access to ${featureKey}. Ask the business owner to grant it.`);
    }

    next();
  });
}

module.exports = { requireFeature };
