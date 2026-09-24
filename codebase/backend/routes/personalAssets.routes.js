/**
 * routes/personalAssets.routes.js
 *
 *   GET    /api/personal/assets       — list
 *   POST   /api/personal/assets       — create
 *   PATCH  /api/personal/assets/:id   — update
 *   DELETE /api/personal/assets/:id   — delete
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/personalAssets.controller');
const { protect } = require('../middleware/auth');
const { requirePersonalSpace } = require('../middleware/requirePersonalSpace');
const { dashboardLimiter } = require('../middleware/rateLimiter');

router.use(dashboardLimiter, protect, requirePersonalSpace);

router.get('/',      controller.getAssets);
router.post('/',     controller.createAsset);
router.patch('/:id', controller.updateAsset);
router.delete('/:id', controller.deleteAsset);

module.exports = router;
