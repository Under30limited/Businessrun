/**
 * routes/advisor.routes.js
 *
 * POST   /api/advisor          → AI Advisor chat (public widget + dashboard)
 * GET    /api/advisor/history  → load the business's persisted chat thread
 * DELETE /api/advisor/history  → clear the business's persisted chat thread
 *
 * POST / uses optionalAuth — works for anonymous users but attaches
 * req.user when a valid session cookie is present, so conversation
 * history can be saved for logged-in dashboard users. See the
 * controller's file header for the public-vs-dashboard split.
 *
 * The /history routes have no public/anonymous equivalent, so they
 * use the standard protect + requireFeature('advisor') stack like any
 * other dashboard route.
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/advisor.controller');
const { protect, optionalAuth } = require('../middleware/auth');
const { requireFeature }        = require('../middleware/permissions');
const { advisorLimiter, dashboardLimiter } = require('../middleware/rateLimiter');
const validate   = require('../middleware/validate');

const advisorSchema = {
  message: { required: true, type: 'string', min: 1, max: 2000 },
};

router.post('/',
  advisorLimiter,
  optionalAuth,
  validate(advisorSchema),
  controller.chat
);

router.get('/history',
  dashboardLimiter,
  protect,
  requireFeature('advisor'),
  controller.getHistory
);

router.delete('/history',
  dashboardLimiter,
  protect,
  requireFeature('advisor'),
  controller.clearHistory
);

module.exports = router;
