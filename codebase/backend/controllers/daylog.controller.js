/**
 * controllers/daylog.controller.js
 *
 * Day Log — the founder's persistent daily business journal.
 *
 * Routes:
 *   GET    /api/daylog          → paginated list of entries (10 per page)
 *   POST   /api/daylog          → create a new entry
 *   PATCH  /api/daylog/:id      → edit an existing entry
 *   DELETE /api/daylog/:id      → delete an entry
 *
 * All routes require a valid JWT cookie (protect middleware).
 *
 * Pagination uses cursor-based pagination (cursorId query param)
 * to avoid loading all entries at once for users with many records.
 */

'use strict';

const asyncHandler    = require('../utils/asyncHandler');
const ApiError        = require('../utils/ApiError');
const { sanitise, requireFields } = require('../utils/sanitise');
const firebaseService = require('../services/db.service');

const MAX_TITLE_LEN = 120;
const MAX_BODY_LEN  = 5000;

// ── GET /api/daylog ───────────────────────────────────────────────
const getEntries = asyncHandler(async (req, res) => {
  const uid      = req.user.uid;
  const limit    = Math.min(parseInt(req.query.limit  || '10', 10), 50);
  const cursorId = req.query.cursor || null;

  const result = await firebaseService.getDayLogEntries(uid, limit, cursorId);
  res.json({ success: true, ...result });
});

// ── POST /api/daylog ──────────────────────────────────────────────
const createEntry = asyncHandler(async (req, res) => {
  const uid  = req.user.uid;
  const body = sanitise(req.body, ['entryDate', 'title', 'body']);
  requireFields(body, ['entryDate', 'body']);

  // entryDate must be a valid ISO date string (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.entryDate)) {
    throw ApiError.badRequest('entryDate must be in YYYY-MM-DD format.');
  }

  const title = (body.title || '').trim().slice(0, MAX_TITLE_LEN);
  const text  = (body.body  || '').trim();

  if (!text) throw ApiError.badRequest('Entry body cannot be empty.');
  if (text.length > MAX_BODY_LEN) {
    throw ApiError.badRequest(`Entry body cannot exceed ${MAX_BODY_LEN} characters.`);
  }

  const entry = await firebaseService.saveDayLogEntry(uid, {
    entryDate: body.entryDate,
    title,
    body: text,
  });

  res.status(201).json({ success: true, entry });
});

// ── PATCH /api/daylog/:id ─────────────────────────────────────────
const updateEntry = asyncHandler(async (req, res) => {
  const uid     = req.user.uid;
  const entryId = req.params.id;
  if (!entryId) throw ApiError.badRequest('Entry id is required.');

  const body    = sanitise(req.body, ['entryDate', 'title', 'body']);
  const updates = {};

  if (body.entryDate !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.entryDate)) {
      throw ApiError.badRequest('entryDate must be in YYYY-MM-DD format.');
    }
    updates.entryDate = body.entryDate;
  }
  if (body.title !== undefined) {
    updates.title = (body.title || '').trim().slice(0, MAX_TITLE_LEN);
  }
  if (body.body !== undefined) {
    const text = (body.body || '').trim();
    if (!text) throw ApiError.badRequest('Entry body cannot be empty.');
    if (text.length > MAX_BODY_LEN) {
      throw ApiError.badRequest(`Entry body cannot exceed ${MAX_BODY_LEN} characters.`);
    }
    updates.body = text;
  }

  if (Object.keys(updates).length === 0) {
    throw ApiError.badRequest('No valid fields provided to update.');
  }

  await firebaseService.updateDayLogEntry(uid, entryId, updates);
  res.json({ success: true });
});

// ── DELETE /api/daylog/:id ────────────────────────────────────────
const deleteEntry = asyncHandler(async (req, res) => {
  const uid     = req.user.uid;
  const entryId = req.params.id;
  if (!entryId) throw ApiError.badRequest('Entry id is required.');

  await firebaseService.deleteDayLogEntry(uid, entryId);
  res.json({ success: true });
});

module.exports = { getEntries, createEntry, updateEntry, deleteEntry };
