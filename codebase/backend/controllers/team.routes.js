/**
 * routes/team.routes.js
 *
 *   POST   /api/team/invite          (owner)     — invite a team member
 *   GET    /api/team                 (owner)     — list team members
 *   PATCH  /api/team/:memberId       (owner)     — update permissions/status
 *   DELETE /api/team/:memberId       (owner)     — remove a member
 *   POST   /api/team/accept-invite   (optional)  — activate a membership
 *
 * accept-invite uses optionalAuth, not protect — it must work for a
 * brand-new/unclaimed identity with NO session at all (password-setup
 * case), but also needs to know whether the caller happens to already
 * be logged in (the already-claimed-identity case, checked inside the
 * controller). It must be registered BEFORE router.use(protect), same
 * reasoning as auth.routes.js's login route.
 */

'use strict';

const express       = require('express');
const router        = express.Router();
const controller    = require('../controllers/team.controller');
const { protect, optionalAuth } = require('../middleware/auth');
const { authLimiter, dataLimiter, dashboardLimiter } = require('../middleware/rateLimiter');

// ── Session optional — see controller for why ───────────────────────
router.post('/accept-invite', authLimiter, optionalAuth, controller.acceptInvite);

// ── Owner-only management — session required ───────────────────────
router.use(protect);

router.post('/invite',        dataLimiter,      controller.inviteMember);
router.get('/',                dashboardLimiter, controller.listMembers);
router.patch('/:memberId',     dashboardLimiter, controller.updateMember);
router.delete('/:memberId',    dashboardLimiter, controller.removeMember);

module.exports = router;
