/**
 * routes/personalDayLog.routes.js
 *
 *   GET    /api/personal/daylog                     — list
 *   POST   /api/personal/daylog                     — create (runs AI extraction)
 *   POST   /api/personal/daylog/:id/move-to-expense  — confirm parsedCash into a real Expense
 *   POST   /api/personal/daylog/:id/toggle-reminder  — toggle parsedPromise's reminder flag
 *   DELETE /api/personal/daylog/:id                  — delete
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/personalDayLog.controller');
const { protect } = require('../middleware/auth');
const { requirePersonalSpace } = require('../middleware/requirePersonalSpace');
const { dashboardLimiter } = require('../middleware/rateLimiter');

router.use(dashboardLimiter, protect, requirePersonalSpace);

router.get('/',      controller.getDayLogEntries);
router.post('/',     controller.createDayLogEntry);
router.post('/:id/move-to-expense', controller.moveToExpense);
router.post('/:id/toggle-reminder', controller.toggleReminder);
router.delete('/:id', controller.deleteDayLogEntry);

module.exports = router;
