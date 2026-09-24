/**
 * routes/nominations.routes.js
 *
 * POST /api/nominations → Top 30 nomination submission
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/nominations.controller');
const { dataLimiter } = require('../middleware/rateLimiter');

router.post('/',
  dataLimiter,
  controller.createNomination
);

module.exports = router;
