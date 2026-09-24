/**
 * routes/inventory.routes.js
 *
 *   GET    /api/inventory        → fetch all items (silent on dashboard load)
 *   POST   /api/inventory        → add item + optional image upload
 *   PATCH  /api/inventory/:id    → update quantity / price / name
 *   DELETE /api/inventory/:id    → delete item + Storage image
 *
 * All routes protected by JWT cookie via protect middleware.
 * POST uses multer middleware before the controller to parse multipart/form-data.
 */

'use strict';

const express        = require('express');
const router         = express.Router();
const controller     = require('../controllers/inventory.controller');
const { protect }    = require('../middleware/auth');
const { requireFeature } = require('../middleware/permissions');
const { requireTeamSeatEntitlement } = require('../middleware/plan');
const { dashboardLimiter } = require('../middleware/rateLimiter');

// All inventory routes require a valid session
router.use(protect);
router.use(requireTeamSeatEntitlement);
router.use(requireFeature('inventory'));

router.get('/',                  dashboardLimiter, controller.getItems);
router.get('/low-stock-count',   dashboardLimiter, controller.getLowStockCount);
router.post('/',                 dashboardLimiter, controller.uploadMiddleware, controller.addItem);
router.get('/:id/history', dashboardLimiter, controller.getItemHistory);
router.patch('/:id',       dashboardLimiter, controller.updateItem);
router.delete('/:id',      dashboardLimiter, controller.deleteItem);

module.exports = router;
