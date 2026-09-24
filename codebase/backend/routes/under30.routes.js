/**
 * routes/under30.routes.js
 *
 * POST /api/under30 → Under30Women mentorship application
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/under30.controller');
const { dataLimiter } = require('../middleware/rateLimiter');
const validate   = require('../middleware/validate');

const under30Schema = {
  fullName:            { required: true,  type: 'string', min: 2 },
  email:               { required: true,  type: 'email'          },
  businessName:        { required: true,  type: 'string', min: 1 },
  businessDescription: { required: true,  type: 'string', min: 20 },
};

router.post('/',
  dataLimiter,
  validate(under30Schema),
  controller.submitApplication
);

module.exports = router;
