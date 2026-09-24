/**
 * routes/roadmap.routes.js
 *
 * POST /api/roadmap-insight → Personalised roadmap insight from Gemini
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/roadmap.controller');
const { roadmapLimiter } = require('../middleware/rateLimiter');
const validate   = require('../middleware/validate');

const roadmapSchema = {
  businessName: { required: true,  type: 'string', min: 1, max: 100 },
  stage:        { required: true,  type: 'string' },
  salesChannel: { required: false, type: 'string' },
  revenue:      { required: false, type: 'string' },
  headache:     { required: false, type: 'string' },
};

router.post('/',
  roadmapLimiter,
  validate(roadmapSchema),
  controller.getInsight
);

module.exports = router;
