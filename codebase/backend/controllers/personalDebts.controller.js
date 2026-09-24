/**
 * controllers/personalDebts.controller.js
 *
 * One entity for both directions and both formal/informal debt — see
 * config/personalOptions.js's DEBT_TYPES comment for why this
 * replaced a separate "Liabilities" concept: `purpose` is free text,
 * so a bank loan and a verbal IOU to a cousin are both just a
 * DebtRecord with a different `type`.
 *
 * Routes:
 *   GET    /api/personal/debts             — list all debt records
 *   POST   /api/personal/debts             — create a debt record
 *   PATCH  /api/personal/debts/:id          — update a debt record's fields
 *   POST   /api/personal/debts/:id/settle   — toggle fully settled
 *   POST   /api/personal/debts/:id/payment  — log a partial payment
 *   DELETE /api/personal/debts/:id          — delete a debt record
 */

'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError      = require('../utils/ApiError');
const { sanitise, requireFields } = require('../utils/sanitise');
const personalService = require('../services/personal.service');
const { DEBT_TYPES, CURRENCIES } = require('../config/personalOptions');

// ── GET /api/personal/debts ──────────────────────────────────────────
const getDebts = asyncHandler(async (req, res) => {
  const debts = await personalService.getDebts(req.user.personalUid);
  res.json({ success: true, debts });
});

// ── POST /api/personal/debts ─────────────────────────────────────────
const createDebt = asyncHandler(async (req, res) => {
  const body = sanitise(req.body, [
    'type', 'personOrEntity', 'phoneNumber', 'amount', 'currency', 'purpose', 'dueDate', 'notes',
  ]);
  requireFields(body, ['type', 'personOrEntity', 'amount', 'currency', 'dueDate']);

  if (!DEBT_TYPES.includes(body.type)) {
    throw ApiError.badRequest(`Invalid debt type: "${body.type}". Must be "i_owe" or "owed_to_me".`);
  }
  if (!CURRENCIES.includes(body.currency)) {
    throw ApiError.badRequest(`Invalid currency: "${body.currency}".`);
  }
  if (typeof body.amount !== 'number' || body.amount <= 0) {
    throw ApiError.badRequest('Amount must be a positive number.');
  }

  const debt = await personalService.createDebt(req.user.personalUid, body);
  res.status(201).json({ success: true, debt });
});

// ── PATCH /api/personal/debts/:id ────────────────────────────────────
const updateDebt = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const body = sanitise(req.body, ['personOrEntity', 'phoneNumber', 'purpose', 'dueDate', 'notes']);

  const existing = await personalService.getDebt(req.user.personalUid, id);
  if (!existing) throw ApiError.badRequest('Debt record not found.');

  await personalService.updateDebt(req.user.personalUid, id, body);
  res.json({ success: true });
});

// ── POST /api/personal/debts/:id/settle ──────────────────────────────
const toggleSettle = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await personalService.getDebt(req.user.personalUid, id);
  if (!existing) throw ApiError.badRequest('Debt record not found.');

  await personalService.toggleSettleDebt(req.user.personalUid, id);
  res.json({ success: true });
});

// ── POST /api/personal/debts/:id/payment ─────────────────────────────
const logPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const body = sanitise(req.body, ['amount']);
  requireFields(body, ['amount']);

  if (typeof body.amount !== 'number' || body.amount <= 0) {
    throw ApiError.badRequest('Payment amount must be a positive number.');
  }

  const existing = await personalService.getDebt(req.user.personalUid, id);
  if (!existing) throw ApiError.badRequest('Debt record not found.');
  if (existing.isSettled) throw ApiError.badRequest('This debt is already fully settled.');

  await personalService.logPartialPayment(req.user.personalUid, id, body.amount);
  res.json({ success: true });
});

// ── DELETE /api/personal/debts/:id ───────────────────────────────────
const deleteDebt = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await personalService.getDebt(req.user.personalUid, id);
  if (!existing) throw ApiError.badRequest('Debt record not found.');

  await personalService.deleteDebt(req.user.personalUid, id);
  res.json({ success: true });
});

module.exports = { getDebts, createDebt, updateDebt, toggleSettle, logPayment, deleteDebt };
