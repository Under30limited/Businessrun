/**
 * routes/personalOnboarding.routes.js
 *
 * POST /api/personal/onboarding → All four Personal Wealth OS
 * onboarding steps (1, 2, 3, 4). Step is determined by the `step`
 * field in the request body — mirrors routes/gyb.routes.js exactly.
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/personalOnboarding.controller');
const { dataLimiter } = require('../middleware/rateLimiter');

router.post('/',
  dataLimiter,
  controller.saveStep
);

module.exports = router;
