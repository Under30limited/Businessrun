/**
 * routes/gyb.routes.js
 *
 * POST /api/gyb → All four onboarding steps (1, 2, 3, 4)
 *
 * Step is determined by the `step` field in the request body.
 * Step 4 handles password hashing verification + full profile save.
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/gyb.controller');
const { dataLimiter } = require('../middleware/rateLimiter');

router.post('/',
  dataLimiter,
  controller.saveStep
);

module.exports = router;
