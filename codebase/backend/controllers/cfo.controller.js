/**
 * controllers/cfo.controller.js
 *
 * Digital CFO — entry management and AI insight generation.
 *
 * All routes are protected — user must have a valid JWT cookie.
 * The uid comes from req.user (set by protect middleware).
 *
 * Routes:
 *   GET  /api/cfo/entries          — load all entries for all 4 tools
 *   POST /api/cfo/entries          — save a new entry to a specific tool
 *   DELETE /api/cfo/entries/:id    — delete an entry by id from a tool
 *   POST /api/cfo/insight          — generate CFO-informed dashboard insight
 */

'use strict';

const asyncHandler    = require('../utils/asyncHandler');
const ApiError        = require('../utils/ApiError');
const { sanitise, requireFields } = require('../utils/sanitise');
const firebaseService = require('../services/db.service');
const geminiService   = require('../services/gemini.service');

const VALID_TOOLS = [
  'General Ledger',
  'Income Statement',
  'Balance Sheet',
  'Cash Flow',
];

// ── GET /api/cfo/entries ──────────────────────────────────────────
/**
 * Returns all saved entries for every tool, keyed by tool name.
 * Called on dashboard load so the CFO tab can pre-populate.
 * Also used to check whether to show CFO insight vs generic insight.
 *
 * Response: { success: true, entries: { 'General Ledger': [...], ... } }
 */
const getAllEntries = asyncHandler(async (req, res) => {
  const uid = req.user.uid;
  if (!uid) throw ApiError.unauthorized('User ID missing from session.');

  const entries = await firebaseService.getAllCFOEntries(uid);
  res.json({ success: true, entries });
});

// ── POST /api/cfo/entries ─────────────────────────────────────────
/**
 * Saves a new entry to a specific tool for the logged-in user.
 * Returns the saved entry (with its server-generated id) so the
 * frontend can add it to local state without a second fetch.
 *
 * Body: { toolName, date, description, amount, category }
 * Response: { success: true, entry: { id, date, description, amount, category, savedAt } }
 */
const saveEntry = asyncHandler(async (req, res) => {
  const uid  = req.user.uid;
  if (!uid) throw ApiError.unauthorized('User ID missing from session.');

  const body = sanitise(req.body, ['toolName', 'date', 'description', 'amount', 'category']);
  requireFields(body, ['toolName', 'date', 'description', 'amount', 'category']);

  if (!VALID_TOOLS.includes(body.toolName)) {
    throw ApiError.badRequest(`Invalid toolName. Must be one of: ${VALID_TOOLS.join(', ')}.`);
  }

  const amount = parseFloat(body.amount);
  if (isNaN(amount) || amount === 0) {
    throw ApiError.badRequest('Amount must be a non-zero number.');
  }

  const entry = {
    date:        body.date,
    description: body.description.trim(),
    amount,
    category:    body.category,
  };

  const saved = await firebaseService.saveCFOEntry(uid, body.toolName, entry);
  res.status(201).json({ success: true, entry: saved });
});

// ── DELETE /api/cfo/entries/:id ───────────────────────────────────
/**
 * Deletes a specific entry from a tool by its id.
 * The toolName must be passed as a query param:
 *   DELETE /api/cfo/entries/abc123?toolName=General+Ledger
 *
 * Response: { success: true }
 */
const deleteEntry = asyncHandler(async (req, res) => {
  const uid      = req.user.uid;
  const entryId  = req.params.id;
  const toolName = req.query.toolName;

  if (!uid)      throw ApiError.unauthorized('User ID missing from session.');
  if (!entryId)  throw ApiError.badRequest('Entry id is required.');
  if (!toolName || !VALID_TOOLS.includes(toolName)) {
    throw ApiError.badRequest(`toolName query param is required and must be one of: ${VALID_TOOLS.join(', ')}.`);
  }

  await firebaseService.deleteCFOEntry(uid, toolName, entryId);
  res.json({ success: true });
});

// ── POST /api/cfo/insight ─────────────────────────────────────────
/**
 * Generates a financially-informed dashboard insight using the user's
 * saved CFO entries. Replaces the generic roadmap insight cards.
 *
 * Called from the frontend on dashboard load when the user has entries.
 * The frontend passes a "Refreshing insights..." indicator while this runs.
 *
 * Body: { profile: { businessName, stage, salesChannel, headache } }
 * Response: { success: true, insight: { prioritySignal, sectorFocus, ... } }
 */
const getCFOInsight = asyncHandler(async (req, res) => {
  const uid = req.user.uid;
  if (!uid) throw ApiError.unauthorized('User ID missing from session.');

  const body = sanitise(req.body, ['profile']);
  if (!body.profile || typeof body.profile !== 'object') {
    throw ApiError.badRequest('profile object is required.');
  }

  // Fetch all entries from Firestore — do this server-side so we
  // always use the authoritative stored data, not stale client state
  const entriesByTool = await firebaseService.getAllCFOEntries(uid);

  // Check that there is actually data to analyse
  const totalEntries = Object.values(entriesByTool).reduce(
    (sum, arr) => sum + arr.length, 0
  );

  if (totalEntries === 0) {
    // No entries — return null so frontend falls back to generic insight
    return res.json({ success: true, insight: null, reason: 'no_entries' });
  }

  const language = (body.profile && body.profile.language) || 'English';

  let result;
  try {
    result = await geminiService.getCFOInsight({
      profile:      body.profile,
      entriesByTool,
      language,
    });
  } catch (err) {
    if (err.statusCode === 503) {
      return res.json({ success: true, insight: null, advisorDown: true });
    }
    throw err;
  }

  res.json({ success: true, insight: result.insight });
});

// ── POST /api/cfo/pulse ───────────────────────────────────────────
/**
 * Generates the Business Pulse by cross-referencing CFO, Inventory
 * and Sales data. Called from the dashboard home tab.
 *
 * Body: { profile, inventory, sales, language }
 * Response: { success: true, pulse: { financialSignal, inventorySignal,
 *             salesSignal, priorityAction, pulseScore } }
 */
const getBusinessPulse = asyncHandler(async (req, res) => {
  const uid = req.user.uid;
  if (!uid) throw ApiError.unauthorized('User ID missing from session.');

  const body = sanitise(req.body, ['profile', 'inventory', 'sales', 'language']);

  // Fetch CFO entries server-side — authoritative
  const cfoEntries = await firebaseService.getAllCFOEntries(uid);
  const language   = body.language || 'English';

  let result;
  try {
    result = await geminiService.getBusinessPulse({
      profile:    body.profile || {},
      cfoEntries,
      inventory:  Array.isArray(body.inventory) ? body.inventory : [],
      sales:      Array.isArray(body.sales)     ? body.sales     : [],
      language,
    });
  } catch (err) {
    if (err.statusCode === 503) {
      return res.json({ success: true, pulse: null, advisorDown: true });
    }
    throw err;
  }

  res.json({ success: true, pulse: result.pulse });
});

module.exports = {
  getAllEntries,
  saveEntry,
  deleteEntry,
  getCFOInsight,
  getBusinessPulse,
};
