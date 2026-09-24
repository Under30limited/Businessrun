/**
 * routes/personalExpenses.routes.js
 *
 *   GET    /api/personal/expenses                   — list
 *   POST   /api/personal/expenses                   — create
 *   PATCH  /api/personal/expenses/:id                — update
 *   DELETE /api/personal/expenses/:id                — delete
 *   POST   /api/personal/expenses/:id/reimbursement  — toggle pending/reimbursed
 *   POST   /api/personal/expenses/:id/receipt        — attach a receipt file
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/personalExpenses.controller');
const { protect } = require('../middleware/auth');
const { requirePersonalSpace } = require('../middleware/requirePersonalSpace');
const { dashboardLimiter } = require('../middleware/rateLimiter');

router.use(dashboardLimiter, protect, requirePersonalSpace);

router.get('/',      controller.getExpenses);
router.post('/',     controller.createExpense);
router.patch('/:id', controller.updateExpense);
router.delete('/:id', controller.deleteExpense);
router.post('/:id/reimbursement', controller.toggleReimbursement);
router.post('/:id/receipt', controller.uploadMiddleware, controller.uploadReceiptHandler);

module.exports = router;
