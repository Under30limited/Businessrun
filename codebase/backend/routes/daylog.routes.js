/**
 * routes/daylog.routes.js
 *
 *   GET    /api/daylog          → paginated list (cursor-based)
 *   POST   /api/daylog          → create entry
 *   PATCH  /api/daylog/:id      → update entry
 *   DELETE /api/daylog/:id      → delete entry
 *
 * All routes protected by JWT cookie.
 */

'use strict';

const express        = require('express');
const router         = express.Router();
const controller     = require('../controllers/daylog.controller');
const { protect }    = require('../middleware/auth');
const { requireFeature } = require('../middleware/permissions');
const { requireTeamSeatEntitlement } = require('../middleware/plan');
const { dashboardLimiter } = require('../middleware/rateLimiter');

router.use(protect);
router.use(requireTeamSeatEntitlement);
router.use(requireFeature('daylog'));

router.get('/',      dashboardLimiter, controller.getEntries);
router.post('/',     dashboardLimiter, controller.createEntry);
router.patch('/:id', dashboardLimiter, controller.updateEntry);
router.delete('/:id',dashboardLimiter, controller.deleteEntry);

module.exports = router;
