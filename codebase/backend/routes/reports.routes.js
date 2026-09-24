/**
 * routes/reports.routes.js
 *
 *   GET    /api/reports/:type            → list saved reports by type
 *   POST   /api/reports/:type/generate   → generate + save (5/day limit)
 *   DELETE /api/reports/:id              → delete a report
 *
 * All routes protected by JWT cookie.
 */

'use strict';

const express      = require('express');
const router       = express.Router();
const controller   = require('../controllers/reports.controller');
const { protect }  = require('../middleware/auth');
const { requireFeature } = require('../middleware/permissions');
const { requirePlan, requireTeamSeatEntitlement } = require('../middleware/plan');
const { advisorLimiter, dashboardLimiter } = require('../middleware/rateLimiter');

router.use(protect);
router.use(requireTeamSeatEntitlement);
router.use(requirePlan('reports'));
router.use(requireFeature('reports'));

router.get('/:type',             dashboardLimiter, controller.getReports);
router.post('/:type/generate',   advisorLimiter,   controller.generateReport);
router.delete('/:id',            dashboardLimiter, controller.deleteReport);

module.exports = router;
