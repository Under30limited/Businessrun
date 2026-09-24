/**
 * routes/personalDebts.routes.js
 *
 *   GET    /api/personal/debts             — list
 *   POST   /api/personal/debts             — create
 *   PATCH  /api/personal/debts/:id          — update
 *   POST   /api/personal/debts/:id/settle   — toggle fully settled
 *   POST   /api/personal/debts/:id/payment  — log a partial payment
 *   DELETE /api/personal/debts/:id          — delete
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/personalDebts.controller');
const { protect } = require('../middleware/auth');
const { requirePersonalSpace } = require('../middleware/requirePersonalSpace');
const { dashboardLimiter } = require('../middleware/rateLimiter');

router.use(dashboardLimiter, protect, requirePersonalSpace);

router.get('/',      controller.getDebts);
router.post('/',     controller.createDebt);
router.patch('/:id', controller.updateDebt);
router.post('/:id/settle', controller.toggleSettle);
router.post('/:id/payment', controller.logPayment);
router.delete('/:id', controller.deleteDebt);

module.exports = router;
