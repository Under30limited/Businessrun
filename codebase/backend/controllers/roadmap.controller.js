/**
 * controllers/roadmap.controller.js
 *
 * Generates the personalised Roadmap insight after GYB onboarding.
 *
 * Route:
 *   POST /api/roadmap-insight
 */

'use strict';

const asyncHandler  = require('../utils/asyncHandler');
const ApiError      = require('../utils/ApiError');
const { sanitise, requireFields } = require('../utils/sanitise');
const geminiService = require('../services/gemini.service');

// ── POST /api/roadmap-insight ─────────────────────────────────────
const getInsight = asyncHandler(async (req, res) => {
  const body = sanitise(req.body, [
    'businessName',
    'stage',
    'salesChannel',
    'revenue',
    'headache',
    'language',
  ]);
  requireFields(body, ['businessName', 'stage']);

  let result;
  try {
    result = await geminiService.getRoadmapInsight({
      businessName: body.businessName,
      stage:        body.stage,
      salesChannel: body.salesChannel,
      revenue:      body.revenue,
      headache:     body.headache,
      language:     body.language || 'English',
    });
  } catch (err) {
    if (err.statusCode === 503) {
      return res.json({ insight: null, advisorDown: true });
    }
    throw err;
  }

  res.json({ insight: result.insight });
});

module.exports = { getInsight };
