/**
 * routes/subscribers.routes.js
 *
 * POST /api/subscribe  → Capital Club signup
 * POST /api/resources  → Resource request
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/subscribers.controller');
const { dataLimiter } = require('../middleware/rateLimiter');
const validate   = require('../middleware/validate');

const subscribeSchema = {
  email: { required: true, type: 'email' },
};

const resourceSchema = {
  email:    { required: true, type: 'email' },
  resource: {
    required: true,
    type:     'string',
    enum:     ['Money-Ready Kit', 'Pitch Deck Template'],
  },
};

router.post('/subscribe',
  dataLimiter,
  validate(subscribeSchema),
  controller.subscribe
);

router.post('/resources',
  dataLimiter,
  validate(resourceSchema),
  controller.requestResource
);

module.exports = router;
