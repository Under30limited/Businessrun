/**
 * controllers/team.controller.js
 *
 * Lets a business owner invite team members and grant them access to
 * a subset of dashboard features. Under the multi-tenant model, a
 * "team member" is just a br-memberships row with role:'member' —
 * the person themselves is an ordinary identity (br-users row) that
 * may separately own their own business, be a member elsewhere, or
 * both. They log in through the exact same POST /api/auth/login as
 * anyone else; what differs is which membership their session is
 * scoped to (see auth.controller.js and middleware/permissions.js).
 *
 * Routes (wired in routes/team.routes.js):
 *   POST   /api/team/invite          (owner only)  — invite by email + permissions
 *   GET    /api/team                 (owner only)  — list all members of THIS business
 *   PATCH  /api/team/:memberId       (owner only)  — update permissions or status
 *   DELETE /api/team/:memberId       (owner only)  — permanently remove a member
 *   POST   /api/team/accept-invite   (public*)     — activate a pending membership
 *
 * *accept-invite uses optionalAuth — see the handler for why: an
 * already-claimed identity must prove itself via an existing session,
 * not just the invite link, before a membership activates.
 *
 * FEATURE KEYS — must match RoadmapPage's tab keys exactly:
 *   inventory | sales | daylog | reports | cfo | advisor
 */

'use strict';

const asyncHandler       = require('../utils/asyncHandler');
const ApiError            = require('../utils/ApiError');
const { sanitise, requireFields, isValidEmail } = require('../utils/sanitise');
const db                  = require('../services/db.service');
const { getSubscriptionSummary } = require('../services/subscription.service');
const { getEffectivePlan } = require('../services/subscription.service');
const { sendInviteEmail } = require('../services/email.service');
const { v4: uuidv4 }      = require('uuid');
const crypto               = require('crypto');
const bcrypt                = require('bcryptjs');
const { signToken, COOKIE_NAME, COOKIE_OPTIONS } = require('../utils/jwt');

const FEATURE_KEYS = ['inventory', 'sales', 'daylog', 'reports', 'cfo', 'advisor'];
const FEATURE_LABELS = {
  inventory: 'Inventory',
  sales:     'Sales Day Book',
  daylog:    'Day Log',
  reports:   'Reports',
  cfo:       'Digital CFO',
  advisor:   'AI Advisor',
};

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const APP_URL = process.env.APP_URL || 'https://thebusinessrun.com';

// ── Guard: only the owner of THIS business manages its team ────────
function requireOwner(req) {
  if (req.user.role === 'member') {
    throw ApiError.forbidden('Only the business owner can manage team access.');
  }
}

function validatePermissions(permissions) {
  if (!Array.isArray(permissions)) {
    throw ApiError.badRequest('permissions must be an array of feature keys.');
  }
  const invalid = permissions.filter(p => !FEATURE_KEYS.includes(p));
  if (invalid.length > 0) {
    throw ApiError.badRequest(
      `Invalid permission${invalid.length > 1 ? 's' : ''}: ${invalid.join(', ')}. ` +
      `Valid keys: ${FEATURE_KEYS.join(', ')}.`
    );
  }
}

function publicMember(m) {
  return {
    uid:         m.identityUid,
    email:       m.email,
    permissions: m.permissions || [],
    status:      m.status,
    invitedAt:   m.invitedAt,
    acceptedAt:  m.acceptedAt || null,
  };
}

// ── POST /api/team/invite ───────────────────────────────────────────
const inviteMember = asyncHandler(async (req, res) => {
  requireOwner(req);

  const body = sanitise(req.body, ['email', 'permissions']);
  requireFields(body, ['email']);

  const email = body.email.toLowerCase().trim();
  if (!isValidEmail(email)) throw ApiError.badRequest('Invalid email address.');

  const permissions = body.permissions || [];
  validatePermissions(permissions);
  if (permissions.length === 0) {
    throw ApiError.badRequest('Grant at least one feature when inviting a team member.');
  }

  const businessUid = req.user.uid; // this session's business scope

  // ── Plan seat limit ─────────────────────────────────────────────
  // plan.limits.teamMembers is a TOTAL user count including the owner
  // (matches the pricing doc's "Users: N" — Zero is 1, meaning owner
  // only, no team invites at all). Only counts active/pending members
  // — a revoked one doesn't occupy a seat.
  const { plan } = await getEffectivePlan(businessUid);
  if (plan.limits.teamMembers !== null) {
    const existingMemberships = await db.getMembershipsForBusiness(businessUid);
    const occupiedSeats = existingMemberships.filter(
      m => m.role === 'member' && m.status !== 'revoked'
    ).length + 1; // +1 for the owner

    if (occupiedSeats >= plan.limits.teamMembers) {
      throw ApiError.badRequest(
        `Your current plan (${plan.name}) allows up to ${plan.limits.teamMembers} user${plan.limits.teamMembers === 1 ? '' : 's'} in total. Upgrade to invite more team members.`
      );
    }
  }

  // Resolve (or create) the invited person's identity. Multi-tenant:
  // if this email already has an identity — whether they own their own
  // business, are already a member elsewhere, or both — we reuse that
  // SAME identity rather than creating a duplicate. They'll use their
  // existing password (if claimed) or set one at accept-invite (if not).
  let identity = await db.getUserByEmail(email);
  let identityUid;

  if (identity) {
    identityUid = identity.uid;

    // Already a member of THIS specific business? Don't allow a
    // second invite on top of an existing membership.
    const existingMembership = await db.getMembership(identityUid, businessUid);
    if (existingMembership && existingMembership.status !== 'revoked') {
      throw ApiError.badRequest(
        existingMembership.status === 'pending'
          ? 'This person has already been invited and has not yet accepted.'
          : 'This person is already on your team.'
      );
    }
  } else {
    // Brand-new email — create an UNCLAIMED identity stub. They'll set
    // a password the first time they accept ANY invite (or register
    // their own business, whichever comes first).
    identityUid = uuidv4();
    await db.createIdentity(identityUid, { email, claimed: false });
  }

  const inviteToken      = crypto.randomBytes(32).toString('hex');
  const inviteExpiresAt = Date.now() + INVITE_EXPIRY_MS;

  await db.createMembership({
    identityUid,
    businessUid,
    role:            'member',
    permissions,
    status:          'pending',
    email,
    invitedBy:       req.user.identityUid,
    inviteToken,
    inviteExpiresAt,
  });

  const inviteUrl = `${APP_URL}/accept-invite?identityUid=${identityUid}&businessUid=${businessUid}&token=${inviteToken}`;

  try {
    await sendInviteEmail({
      to:                email,
      ownerBusinessName: req.user.businessName || 'BusinessRun',
      inviteUrl,
      featureLabels:     permissions.map(p => FEATURE_LABELS[p]),
    });
  } catch (err) {
    // The membership record exists either way — owner can resend by
    // removing and re-inviting if the email genuinely never arrives.
    console.error('[Team] Invite email failed to send:', err.message);
  }

  res.status(201).json({ success: true, message: `Invite sent to ${email}.` });
});

// ── GET /api/team ────────────────────────────────────────────────────
const listMembers = asyncHandler(async (req, res) => {
  requireOwner(req);
  const memberships = await db.getMembershipsForBusiness(req.user.uid);
  res.json({ success: true, members: memberships.filter(m => m.role === 'member').map(publicMember) });
});

// ── PATCH /api/team/:memberId ────────────────────────────────────────
// :memberId is the member's identityUid.
const updateMember = asyncHandler(async (req, res) => {
  requireOwner(req);

  const { memberId } = req.params;
  const membership = await db.getMembership(memberId, req.user.uid);
  if (!membership || membership.role !== 'member') {
    throw ApiError.notFound('Team member not found.');
  }

  const body    = sanitise(req.body, ['permissions', 'status']);
  const updates = {};

  if (body.permissions !== undefined) {
    validatePermissions(body.permissions);
    updates.permissions = body.permissions;
  }

  if (body.status !== undefined) {
    if (!['active', 'revoked'].includes(body.status)) {
      throw ApiError.badRequest('status must be "active" or "revoked".');
    }
    if (body.status === 'active' && membership.status === 'pending') {
      throw ApiError.badRequest('This member has not accepted their invite yet.');
    }
    updates.status = body.status;
  }

  if (Object.keys(updates).length === 0) {
    throw ApiError.badRequest('Nothing to update — provide permissions and/or status.');
  }

  await db.updateMembership(memberId, req.user.uid, updates);
  res.json({ success: true, message: 'Team member updated.' });
});

// ── DELETE /api/team/:memberId ───────────────────────────────────────
const removeMember = asyncHandler(async (req, res) => {
  requireOwner(req);

  const { memberId } = req.params;
  const membership = await db.getMembership(memberId, req.user.uid);
  if (!membership || membership.role !== 'member') {
    throw ApiError.notFound('Team member not found.');
  }

  await db.deleteMembership(memberId, req.user.uid);
  res.json({ success: true, message: 'Team member removed.' });
});

// ── POST /api/team/accept-invite ─────────────────────────────────────
/**
 * Body: { identityUid, businessUid, token, password? }
 *
 * Uses optionalAuth (see routes/team.routes.js) — req.user may or may
 * not be set, depending on whether the browser already has a session
 * cookie.
 *
 * Two cases:
 *   - Identity UNCLAIMED (first invite this person has ever accepted,
 *     or they've never registered their own business either): the
 *     invite link itself is the proof of access — password is
 *     required, sets it, claims the identity.
 *   - Identity ALREADY CLAIMED (they have a real password from
 *     somewhere — their own business, or a previous accepted invite):
 *     the invite link alone is NOT enough proof — anyone who
 *     intercepts the link could otherwise activate a membership on a
 *     claimed account without knowing its password. They must already
 *     be logged in AS THAT IDENTITY (req.user.identityUid must match)
 *     to activate it. No password field needed in this case.
 */
const acceptInvite = asyncHandler(async (req, res) => {
  const body = sanitise(req.body, ['identityUid', 'businessUid', 'token', 'password']);
  requireFields(body, ['identityUid', 'businessUid', 'token']);

  const membership = await db.getMembership(body.identityUid, body.businessUid);
  if (!membership || membership.role !== 'member') {
    throw ApiError.badRequest('Invalid or expired invite link.');
  }
  if (membership.status === 'revoked') {
    throw ApiError.forbidden('This invite has been revoked.');
  }
  if (membership.status === 'active') {
    throw ApiError.badRequest('This invite has already been accepted. Please log in instead.');
  }
  if (membership.inviteToken !== body.token) {
    throw ApiError.badRequest('Invalid or expired invite link.');
  }
  if (Date.now() > membership.inviteExpiresAt) {
    throw ApiError.badRequest('This invite link has expired. Ask the business owner to resend it.');
  }

  const identity = await db.getUserByUid(body.identityUid);
  if (!identity) {
    throw ApiError.badRequest('Invalid invite link.');
  }

  if (!identity.claimed) {
    // Unclaimed — the link is the proof, password sets it up
    if (typeof body.password !== 'string' || body.password.length < 6) {
      throw ApiError.badRequest('Password must be at least 6 characters.');
    }
    const hashedPassword = await bcrypt.hash(body.password, 12);
    await db.updateUserPassword(body.identityUid, hashedPassword);
  } else {
    // Already claimed — the link alone is not enough proof. Require
    // them to already be logged in as this exact identity.
    //
    // Returned directly (not thrown as ApiError) so the response can
    // carry structured data — `requiresLogin` + the email to pre-fill
    // — letting the frontend show an embedded login step and
    // automatically retry this same call afterward, instead of just
    // displaying a message and stopping.
    if (!req.user || req.user.identityUid !== body.identityUid) {
      return res.status(401).json({
        success:        false,
        requiresLogin:  true,
        email:          identity.email,
        message:        'This email already has an account. Log in to accept this invite.',
      });
    }
  }

  await db.acceptMembership(body.identityUid, body.businessUid);

  const business = await db.getBusiness(body.businessUid);

  const sessionProfile = {
    identityUid:  body.identityUid,
    businessUid:  body.businessUid,
    role:         'member',
    permissions:  membership.permissions || [],
    email:        identity.email,
    fullName:     identity.fullName || '',
    businessName: business?.businessName || '',
    stage:        business?.stage        || '',
    salesChannel: business?.salesChannel || '',
    revenue:      business?.revenue      || '',
    headache:     business?.headache     || '',
    matchmaking:  business?.matchmaking  || '',
  };

  const token = signToken(sessionProfile);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

  const { subscription, teamAccessBlocked } = await getSubscriptionSummary(sessionProfile.businessUid, 'member');

  res.status(200).json({
    success: true,
    profile: {
      uid:          sessionProfile.identityUid,
      businessUid:  sessionProfile.businessUid,
      role:         'member',
      permissions:  sessionProfile.permissions,
      email:        sessionProfile.email,
      fullName:     sessionProfile.fullName,
      businessName: sessionProfile.businessName,
    },
    subscription,
    teamAccessBlocked,
  });
});

module.exports = { inviteMember, listMembers, updateMember, removeMember, acceptInvite, FEATURE_KEYS };
