/**
 * controllers/personalAccounts.controller.js
 *
 * Bank/fintech/domiciliary/investment/crypto accounts — the "where
 * your money sits" layer that Income and Expenses link against.
 * Every route requires protect + requirePersonalSpace (see routes/
 * personalAccounts.routes.js) — uid comes from req.user.personalUid.
 *
 * Routes:
 *   GET    /api/personal/accounts       — list all accounts
 *   POST   /api/personal/accounts       — create an account
 *   PATCH  /api/personal/accounts/:id   — update an account
 *   DELETE /api/personal/accounts/:id   — delete an account
 *
 * NEVER accept a full account number here — accountNumberMask is for
 * a masked reference only (e.g. "••3041"), same principle applied
 * throughout this module.
 */

'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError      = require('../utils/ApiError');
const { sanitise, requireFields } = require('../utils/sanitise');
const personalService = require('../services/personal.service');
const { ACCOUNT_TYPES, CURRENCIES } = require('../config/personalOptions');

// ── GET /api/personal/accounts ──────────────────────────────────────
const getAccounts = asyncHandler(async (req, res) => {
  const accounts = await personalService.getAccounts(req.user.personalUid);
  res.json({ success: true, accounts });
});

// ── POST /api/personal/accounts ─────────────────────────────────────
const createAccount = asyncHandler(async (req, res) => {
  const body = sanitise(req.body, ['name', 'bankName', 'accountNumberMask', 'currency', 'balance', 'type', 'colorTag']);
  requireFields(body, ['name', 'currency', 'type']);

  if (!ACCOUNT_TYPES.includes(body.type)) {
    throw ApiError.badRequest(`Invalid account type: "${body.type}".`);
  }
  if (!CURRENCIES.includes(body.currency)) {
    throw ApiError.badRequest(`Invalid currency: "${body.currency}".`);
  }
  if (body.accountNumberMask && body.accountNumberMask.replace(/[^0-9]/g, '').length > 6) {
    // A masked reference should only ever carry a handful of trailing
    // digits (e.g. "••3041") — reject anything long enough to plausibly
    // be a real account number someone pasted in by mistake.
    throw ApiError.badRequest('Only the last few digits of an account number should be entered — never the full number.');
  }

  const account = await personalService.createAccount(req.user.personalUid, body);
  res.status(201).json({ success: true, account });
});

// ── PATCH /api/personal/accounts/:id ────────────────────────────────
const updateAccount = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const body = sanitise(req.body, ['name', 'bankName', 'accountNumberMask', 'currency', 'balance', 'type', 'colorTag']);

  if (body.type && !ACCOUNT_TYPES.includes(body.type)) {
    throw ApiError.badRequest(`Invalid account type: "${body.type}".`);
  }
  if (body.currency && !CURRENCIES.includes(body.currency)) {
    throw ApiError.badRequest(`Invalid currency: "${body.currency}".`);
  }

  const existing = await personalService.getAccount(req.user.personalUid, id);
  if (!existing) throw ApiError.badRequest('Account not found.');

  await personalService.updateAccount(req.user.personalUid, id, body);
  res.json({ success: true });
});

// ── DELETE /api/personal/accounts/:id ───────────────────────────────
const deleteAccount = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await personalService.getAccount(req.user.personalUid, id);
  if (!existing) throw ApiError.badRequest('Account not found.');

  await personalService.deleteAccount(req.user.personalUid, id);
  res.json({ success: true });
});

module.exports = { getAccounts, createAccount, updateAccount, deleteAccount };
