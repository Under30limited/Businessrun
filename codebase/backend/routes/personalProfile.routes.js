/**
 * routes/personalProfile.routes.js
 *
 * GET/PATCH /api/personal/profile — self-service profile edits for
 * an already-signed-in personal space, most importantly changing
 * displayCurrency "at will" from the dashboard. Same middleware
 * stack as every other personal route: protect → requirePersonalSpace
 * → rate limiter → controller (see routes/personalAccounts.routes.js
 * for the pattern this mirrors).
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/personalProfile.controller');
const { protect } = require('../middleware/auth');
const { requirePersonalSpace } = require('../middleware/requirePersonalSpace');
const { dashboardLimiter } = require('../middleware/rateLimiter');

router.use(dashboardLimiter, protect, requirePersonalSpace);

router.get('/', controller.getProfile);
router.patch('/', controller.updateProfile);

module.exports = router;
