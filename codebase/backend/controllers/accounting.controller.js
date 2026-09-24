/**
 * controllers/accounting.controller.js
 *
 * Handles the AI Accounting Tools report generation.
 *
 * Route:
 *   POST /api/accounting
 */

'use strict';

const asyncHandler  = require('../utils/asyncHandler');
const ApiError      = require('../utils/ApiError');
const { sanitise, requireFields } = require('../utils/sanitise');
const geminiService = require('../services/gemini.service');

const VALID_TOOLS = [
  'General Ledger',
  'Income Statement',
  'Balance Sheet',
  'Cash Flow',
];

// ── POST /api/accounting ──────────────────────────────────────────
const generateReport = asyncHandler(async (req, res) => {
  const body = sanitise(req.body, ['transactions', 'activeTool']);
  requireFields(body, ['transactions', 'activeTool']);

  if (!Array.isArray(body.transactions) || body.transactions.length === 0) {
    throw ApiError.badRequest(
      'Transactions must be a non-empty array.'
    );
  }

  if (!VALID_TOOLS.includes(body.activeTool)) {
    throw ApiError.badRequest(
      `Invalid tool. Must be one of: ${VALID_TOOLS.join(', ')}.`
    );
  }

  // Cap the number of transactions to prevent oversized Gemini payloads
  if (body.transactions.length > 100) {
    throw ApiError.badRequest(
      'Maximum 100 transactions per report. Please split into smaller batches.'
    );
  }

  let result;
  try {
    result = await geminiService.getAccountingReport(
      body.transactions,
      body.activeTool
    );
  } catch (err) {
    if (err.statusCode === 503) {
      return res.json({ result: null, advisorDown: true });
    }
    throw err;
  }

  res.json({ result: result.result });
});

module.exports = { generateReport };
