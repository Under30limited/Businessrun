/**
 * routes/personalGoals.routes.js
 *
 *   GET    /api/personal/goals               — list
 *   POST   /api/personal/goals               — create
 *   PATCH  /api/personal/goals/:id            — update
 *   POST   /api/personal/goals/:id/contribute — add to savedAmount
 *   DELETE /api/personal/goals/:id            — delete
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/personalGoals.controller');
const { protect } = require('../middleware/auth');
const { requirePersonalSpace } = require('../middleware/requirePersonalSpace');
const { dashboardLimiter } = require('../middleware/rateLimiter');

router.use(dashboardLimiter, protect, requirePersonalSpace);

router.get('/',      controller.getGoals);
router.post('/',     controller.createGoal);
router.patch('/:id', controller.updateGoal);
router.post('/:id/contribute', controller.contributeToGoal);
router.delete('/:id', controller.deleteGoal);

module.exports = router;
