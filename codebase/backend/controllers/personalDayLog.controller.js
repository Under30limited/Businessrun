/**
 * controllers/personalDayLog.controller.js
 *
 * The daily financial journal. Free text in, with automatic AI
 * extraction attempted on every entry (see services/wealthAdvisor.
 * service.js) — a possible cash amount and/or a possible verbal
 * promise, surfaced back on the entry for the founder to act on.
 *
 * ── AI SUGGESTS, THE FOUNDER CONFIRMS ─────────────────────────────
 * Creating an entry NEVER creates a real Expense or Debt record by
 * itself — parsedCash/parsedPromise sit inertly on the entry until
 * the founder explicitly acts:
 *   - "Move to Expenses" actually creates a real Expense record, and
 *     REQUIRES the founder to pick a category — the AI extraction
 *     deliberately never guesses one (see wealthAdvisor.service.js),
 *     so this endpoint won't guess one either.
 *   - "Set reminder" just flips a boolean flag on the entry — it does
 *     NOT create a DebtRecord automatically. Promoting a promise into
 *     a full debt record is a separate, deliberate action the founder
 *     takes via the Debts tab if they choose to.
 *
 * Routes:
 *   GET    /api/personal/daylog                       — list all entries
 *   POST   /api/personal/daylog                       — create an entry (runs AI extraction)
 *   POST   /api/personal/daylog/:id/move-to-expense    — confirm parsedCash into a real Expense
 *   POST   /api/personal/daylog/:id/toggle-reminder    — toggle parsedPromise's reminder flag
 *   DELETE /api/personal/daylog/:id                    — delete an entry
 */

'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError      = require('../utils/ApiError');
const { sanitise, requireFields } = require('../utils/sanitise');
const personalService  = require('../services/personal.service');
const wealthAdvisorService = require('../services/wealthAdvisor.service');
const { EXPENSE_CATEGORIES } = require('../config/personalOptions');

// ── GET /api/personal/daylog ─────────────────────────────────────────
const getDayLogEntries = asyncHandler(async (req, res) => {
  const entries = await personalService.getDayLogEntries(req.user.personalUid);
  res.json({ success: true, entries });
});

// ── POST /api/personal/daylog ────────────────────────────────────────
const createDayLogEntry = asyncHandler(async (req, res) => {
  const body = sanitise(req.body, ['content', 'date', 'tags']);
  requireFields(body, ['content']);

  if (typeof body.content !== 'string' || !body.content.trim()) {
    throw ApiError.badRequest('Journal entry cannot be empty.');
  }
  if (body.content.length > 4000) {
    throw ApiError.badRequest('Journal entry is too long. Maximum 4000 characters.');
  }

  // Non-fatal by design — see wealthAdvisor.service.js's
  // parseDayLogEntry docs. The entry is saved either way.
  const { parsedCash, parsedPromise } = await wealthAdvisorService.parseDayLogEntry(body.content);

  const entry = await personalService.createDayLogEntry(req.user.personalUid, {
    ...body,
    parsedCash,
    parsedPromise,
  });

  res.status(201).json({ success: true, entry });
});

// ── POST /api/personal/daylog/:id/move-to-expense ────────────────────
const moveToExpense = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const body = sanitise(req.body, ['category']);
  requireFields(body, ['category']);

  if (!EXPENSE_CATEGORIES.includes(body.category)) {
    throw ApiError.badRequest(`Invalid expense category: "${body.category}".`);
  }

  const entry = await personalService.getDayLogEntry(req.user.personalUid, id);
  if (!entry) throw ApiError.badRequest('Day Log entry not found.');
  if (!entry.parsedCash) throw ApiError.badRequest('This entry has no extracted cash amount to move.');
  if (entry.parsedCash.movedToExpenses) throw ApiError.badRequest('This entry has already been moved to Expenses.');

  const expense = await personalService.createExpense(req.user.personalUid, {
    title:    entry.parsedCash.description || 'From Day Log',
    category: body.category,
    amount:   entry.parsedCash.amount,
    currency: entry.parsedCash.currency,
    date:     (entry.date || entry.createdAt).slice(0, 10),
    notes:    `Logged from Day Log entry on ${entry.createdAt.slice(0, 10)}.`,
  });

  await personalService.markCashMovedToExpenses(req.user.personalUid, id);

  res.json({ success: true, expense });
});

// ── POST /api/personal/daylog/:id/toggle-reminder ────────────────────
const toggleReminder = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const entry = await personalService.getDayLogEntry(req.user.personalUid, id);
  if (!entry) throw ApiError.badRequest('Day Log entry not found.');
  if (!entry.parsedPromise) throw ApiError.badRequest('This entry has no extracted promise to remind about.');

  await personalService.toggleReminderSet(req.user.personalUid, id);
  res.json({ success: true });
});

// ── DELETE /api/personal/daylog/:id ──────────────────────────────────
const deleteDayLogEntry = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await personalService.deleteDayLogEntry(req.user.personalUid, id);
  res.json({ success: true });
});

module.exports = { getDayLogEntries, createDayLogEntry, moveToExpense, toggleReminder, deleteDayLogEntry };
