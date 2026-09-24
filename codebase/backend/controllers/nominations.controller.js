/**
 * controllers/nominations.controller.js
 *
 * Handles Top 30 nomination submissions.
 *
 * Route:
 *   POST /api/nominations
 */

'use strict';

const asyncHandler    = require('../utils/asyncHandler');
const ApiError        = require('../utils/ApiError');
const { sanitise, requireFields, isValidEmail } = require('../utils/sanitise');
const firebaseService = require('../services/db.service');

const VALID_INDUSTRIES = [
  'Finance & Fintech',
  'Technology',
  'Agriculture & Food',
  'Health & MedTech',
  'Fashion & Art',
  'Media & Entertainment',
  'Logistics & Supply Chain',
  'Education & EdTech',
  'Energy & CleanTech',
  'Real Estate & PropTech',
  'Retail & E-commerce',
  'Social Impact & NGO',
  'Other',
];

// ── POST /api/nominations ─────────────────────────────────────────
const createNomination = asyncHandler(async (req, res) => {
  const body = sanitise(req.body, [
    'nomineeName',
    'nomineeAge',
    'nomineeCompany',
    'nomineePosition',
    'nomineeIndustry',
    'nomineeLocation',
    'achievement',
    'impact',
    'socialOrWebsite',
    'nominatorName',
    'nominatorEmail',
    'relationship',
    'consent',
    'submittedAt',
    'source',
  ]);

  // Required fields
  requireFields(body, [
    'nomineeName',
    'nomineeAge',
    'nomineeCompany',
    'nomineeIndustry',
    'nomineeLocation',
    'achievement',
    'impact',
    'nominatorName',
    'nominatorEmail',
    'relationship',
  ]);

  // Age must be between 16 and 30
  const age = parseInt(body.nomineeAge);
  if (isNaN(age) || age < 16 || age > 30) {
    throw ApiError.badRequest('Nominee age must be between 16 and 30.');
  }

  if (!isValidEmail(body.nominatorEmail)) {
    throw ApiError.badRequest('Invalid nominator email address.');
  }

  if (!VALID_INDUSTRIES.includes(body.nomineeIndustry)) {
    throw ApiError.badRequest(
      `Invalid industry. Must be one of: ${VALID_INDUSTRIES.join(', ')}.`
    );
  }

  if (!body.consent) {
    throw ApiError.badRequest(
      'You must confirm that the information provided is accurate.'
    );
  }

  const { id } = await firebaseService.createNomination({
    nomineeName:     body.nomineeName.trim(),
    nomineeAge:      age,
    nomineeCompany:  body.nomineeCompany.trim(),
    nomineePosition: body.nomineePosition?.trim() || '',
    nomineeIndustry: body.nomineeIndustry,
    nomineeLocation: body.nomineeLocation.trim(),
    achievement:     body.achievement.trim(),
    impact:          body.impact.trim(),
    socialOrWebsite: body.socialOrWebsite?.trim() || '',
    nominatorName:   body.nominatorName.trim(),
    nominatorEmail:  body.nominatorEmail.toLowerCase().trim(),
    relationship:    body.relationship.trim(),
    source:          body.source || 'businessrun-top30-nomination',
  });

  res.status(201).json({ success: true, id });
});

module.exports = { createNomination };
