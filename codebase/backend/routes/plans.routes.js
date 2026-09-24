/**
 * routes/plans.routes.js
 *
 *   GET /api/plans  (public) — every plan definition + live NGN pricing
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/plans.controller');
const { dataLimiter } = require('../middleware/rateLimiter');

router.get('/', dataLimiter, controller.getPlans);

module.exports = router;
