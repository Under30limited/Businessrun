/**
 * routes/personalNetWorth.routes.js
 *
 *   GET /api/personal/networth          — current totals (live computed, lazy-snapshots today)
 *   GET /api/personal/networth/history  — real historical trend
 *   GET /api/personal/networth/cashflow — this month's income vs expenses
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/personalNetWorth.controller');
const { protect } = require('../middleware/auth');
const { requirePersonalSpace } = require('../middleware/requirePersonalSpace');
const { dashboardLimiter } = require('../middleware/rateLimiter');

router.use(dashboardLimiter, protect, requirePersonalSpace);

router.get('/',          controller.getNetWorth);
router.get('/history',   controller.getNetWorthHistory);
router.get('/cashflow',  controller.getCashFlow);

module.exports = router;
