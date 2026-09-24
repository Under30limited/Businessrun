/**
 * controllers/personalGoals.controller.js
 *
 * Savings goals — target amount, progress, optional linked account.
 *
 * Routes:
 *   GET    /api/personal/goals               — list all goals
 *   POST   /api/personal/goals               — create a goal
 *   PATCH  /api/personal/goals/:id            — update a goal's fields
 *   POST   /api/personal/goals/:id/contribute — add an amount toward savedAmount
 *   DELETE /api/personal/goals/:id            — delete a goal
 */

'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError      = require('../utils/ApiError');
const { sanitise, requireFields } = require('../utils/sanitise');
const personalService = require('../services/personal.service');
const { GOAL_CATEGORIES, CURRENCIES } = require('../config/personalOptions');

// ── GET /api/personal/goals ──────────────────────────────────────────
const getGoals = asyncHandler(async (req, res) => {
  const goals = await personalService.getGoals(req.user.personalUid);
  res.json({ success: true, goals });
});

// ── POST /api/personal/goals ─────────────────────────────────────────
const createGoal = asyncHandler(async (req, res) => {
  const body = sanitise(req.body, [
    'name', 'category', 'targetAmount', 'currency', 'savedAmount', 'targetDate',
    'accountId', 'accountName', 'notes',
  ]);
  requireFields(body, ['name', 'category', 'targetAmount', 'currency', 'targetDate']);

  if (!GOAL_CATEGORIES.includes(body.category)) {
    throw ApiError.badRequest(`Invalid goal category: "${body.category}".`);
  }
  if (!CURRENCIES.includes(body.currency)) {
    throw ApiError.badRequest(`Invalid currency: "${body.currency}".`);
  }
  if (typeof body.targetAmount !== 'number' || body.targetAmount <= 0) {
    throw ApiError.badRequest('Target amount must be a positive number.');
  }

  if (body.accountId) {
    const account = await personalService.getAccount(req.user.personalUid, body.accountId);
    if (!account) throw ApiError.badRequest('Linked account not found.');
  }

  const goal = await personalService.createGoal(req.user.personalUid, body);
  res.status(201).json({ success: true, goal });
});

// ── PATCH /api/personal/goals/:id ────────────────────────────────────
const updateGoal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const body = sanitise(req.body, ['name', 'category', 'targetAmount', 'targetDate', 'notes']);

  if (body.category && !GOAL_CATEGORIES.includes(body.category)) {
    throw ApiError.badRequest(`Invalid goal category: "${body.category}".`);
  }

  const existing = await personalService.getGoal(req.user.personalUid, id);
  if (!existing) throw ApiError.badRequest('Goal not found.');

  await personalService.updateGoal(req.user.personalUid, id, body);
  res.json({ success: true });
});

// ── POST /api/personal/goals/:id/contribute ──────────────────────────
const contributeToGoal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const body = sanitise(req.body, ['amount']);
  requireFields(body, ['amount']);

  if (typeof body.amount !== 'number' || body.amount <= 0) {
    throw ApiError.badRequest('Contribution amount must be a positive number.');
  }

  const goal = await personalService.getGoal(req.user.personalUid, id);
  if (!goal) throw ApiError.badRequest('Goal not found.');

  const nextSaved = (goal.savedAmount || 0) + body.amount;
  await personalService.updateGoalSavedAmount(req.user.personalUid, id, nextSaved);
  res.json({ success: true, savedAmount: Math.max(0, nextSaved) });
});

// ── DELETE /api/personal/goals/:id ───────────────────────────────────
const deleteGoal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await personalService.getGoal(req.user.personalUid, id);
  if (!existing) throw ApiError.badRequest('Goal not found.');

  await personalService.deleteGoal(req.user.personalUid, id);
  res.json({ success: true });
});

module.exports = { getGoals, createGoal, updateGoal, contributeToGoal, deleteGoal };
