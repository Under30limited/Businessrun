/**
 * routes/personalIncome.routes.js
 *
 *   GET    /api/personal/income              — list
 *   POST   /api/personal/income              — create
 *   PATCH  /api/personal/income/:id          — update
 *   DELETE /api/personal/income/:id          — delete
 *   POST   /api/personal/income/:id/receipt  — attach a receipt file
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/personalIncome.controller');
const { protect } = require('../middleware/auth');
const { requirePersonalSpace } = require('../middleware/requirePersonalSpace');
const { dashboardLimiter } = require('../middleware/rateLimiter');

router.use(dashboardLimiter, protect, requirePersonalSpace);

router.get('/',      controller.getIncome);
router.post('/',     controller.createIncome);
router.patch('/:id', controller.updateIncome);
router.delete('/:id', controller.deleteIncome);
router.post('/:id/receipt', controller.uploadMiddleware, controller.uploadReceiptHandler);

module.exports = router;
