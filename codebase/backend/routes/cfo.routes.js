/**
 * routes/cfo.routes.js
 *
 * All Digital CFO routes are protected — valid JWT cookie required.
 *
 *   GET    /api/cfo/entries         → load all tool entries for the user
 *   POST   /api/cfo/entries         → save a new entry
 *   DELETE /api/cfo/entries/:id     → delete an entry (toolName in query)
 *   POST   /api/cfo/insight         → generate AI insight from entries
 */

'use strict';

const express        = require('express');
const router         = express.Router();
const controller     = require('../controllers/cfo.controller');
const { protect }    = require('../middleware/auth');
const { requireFeature } = require('../middleware/permissions');
const { requirePlan, requireTeamSeatEntitlement } = require('../middleware/plan');
const { accountingLimiter, advisorLimiter, dashboardLimiter } = require('../middleware/rateLimiter');

// All CFO routes require a valid session
router.use(protect);
router.use(requireTeamSeatEntitlement);
router.use(requirePlan('cfo'));
router.use(requireFeature('cfo'));

// Entry management
router.get('/entries',         dashboardLimiter,  controller.getAllEntries);
router.post('/entries',        dashboardLimiter,  controller.saveEntry);
router.delete('/entries/:id',  dashboardLimiter,  controller.deleteEntry);

// AI insight generation (uses Gemini — stricter rate limit)
router.post('/insight',        advisorLimiter,    controller.getCFOInsight);

// Business Pulse — cross-layer intelligence (CFO + Inventory + Sales)
router.post('/pulse',          advisorLimiter,    controller.getBusinessPulse);

module.exports = router;
