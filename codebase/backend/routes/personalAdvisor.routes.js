/**
 * routes/personalAdvisor.routes.js
 *
 *   POST   /api/personal/advisor          — chat
 *   GET    /api/personal/advisor/history  — load persisted thread
 *   DELETE /api/personal/advisor/history  — clear persisted thread
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/personalAdvisor.controller');
const { protect } = require('../middleware/auth');
const { requirePersonalSpace } = require('../middleware/requirePersonalSpace');
const { advisorLimiter, dashboardLimiter } = require('../middleware/rateLimiter');

router.post('/',
  advisorLimiter,
  protect,
  requirePersonalSpace,
  controller.chat
);

router.get('/history',
  dashboardLimiter,
  protect,
  requirePersonalSpace,
  controller.getHistory
);

router.delete('/history',
  dashboardLimiter,
  protect,
  requirePersonalSpace,
  controller.clearHistory
);

module.exports = router;
