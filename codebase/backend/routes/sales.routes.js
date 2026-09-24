/**
 * routes/sales.routes.js
 *
 *   GET  /api/sales   → fetch all sales (optional ?from=&to= date filter)
 *   POST /api/sales   → record a sale + deduct inventory stock
 *
 * All routes protected by JWT cookie.
 */

'use strict';

const express        = require('express');
const router         = express.Router();
const controller     = require('../controllers/sales.controller');
const { protect }    = require('../middleware/auth');
const { requireFeature } = require('../middleware/permissions');
const { requireTeamSeatEntitlement } = require('../middleware/plan');
const { dashboardLimiter } = require('../middleware/rateLimiter');

router.use(protect);
router.use(requireTeamSeatEntitlement);
router.use(requireFeature('sales'));

router.get('/',     dashboardLimiter, controller.getSales);
router.post('/',    dashboardLimiter, controller.logSale);
router.patch('/:id', dashboardLimiter, controller.updateSale);
router.delete('/:id', dashboardLimiter, controller.deleteSale);

module.exports = router;
