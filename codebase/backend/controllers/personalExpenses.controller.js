/**
 * controllers/personalExpenses.controller.js
 *
 * The primary spending tracker. Creating an expense can atomically:
 *   - deduct a linked account's balance
 *   - deduct a linked income envelope's amountSpent
 * both handled inside personal.service.js's createExpense/deleteExpense
 * via a single TransactWriteCommand — this controller just validates
 * input and calls through.
 *
 * Routes:
 *   GET    /api/personal/expenses                       — list all expenses
 *   POST   /api/personal/expenses                       — create (may deduct account/envelope)
 *   PATCH  /api/personal/expenses/:id                    — update non-financial fields only
 *   DELETE /api/personal/expenses/:id                    — delete (restores account/envelope)
 *   POST   /api/personal/expenses/:id/reimbursement      — toggle pending/reimbursed
 *   POST   /api/personal/expenses/:id/receipt            — attach a receipt file
 *
 * See personal.service.js's updateExpense for why amount/currency/
 * accountId/envelopeStreamId can never be edited after creation —
 * delete + recreate is the safe path for correcting those.
 */

'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError      = require('../utils/ApiError');
const { sanitise, requireFields } = require('../utils/sanitise');
const personalService = require('../services/personal.service');
const multer          = require('multer');
const { EXPENSE_CATEGORIES, CURRENCIES } = require('../config/personalOptions');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError(400, 'Only JPEG, PNG, WebP images or a PDF are accepted for a receipt.'));
    }
  },
});
const uploadMiddleware = upload.single('receipt');

// ── GET /api/personal/expenses ──────────────────────────────────────
const getExpenses = asyncHandler(async (req, res) => {
  const expenses = await personalService.getExpenses(req.user.personalUid);
  res.json({ success: true, expenses });
});

// ── POST /api/personal/expenses ─────────────────────────────────────
const createExpense = asyncHandler(async (req, res) => {
  const body = sanitise(req.body, [
    'title', 'category', 'amount', 'currency', 'accountId', 'accountName',
    'envelopeStreamId', 'envelopeTitle', 'isBusinessReimbursement', 'date', 'notes',
  ]);
  requireFields(body, ['title', 'category', 'amount', 'currency']);

  if (!EXPENSE_CATEGORIES.includes(body.category)) {
    throw ApiError.badRequest(`Invalid expense category: "${body.category}".`);
  }
  if (!CURRENCIES.includes(body.currency)) {
    throw ApiError.badRequest(`Invalid currency: "${body.currency}".`);
  }
  if (typeof body.amount !== 'number' || body.amount <= 0) {
    throw ApiError.badRequest('Amount must be a positive number.');
  }

  if (body.accountId) {
    const account = await personalService.getAccount(req.user.personalUid, body.accountId);
    if (!account) throw ApiError.badRequest('Linked account not found.');
  }
  if (body.envelopeStreamId) {
    const stream = await personalService.getIncomeStream(req.user.personalUid, body.envelopeStreamId);
    if (!stream) throw ApiError.badRequest('Linked income envelope not found.');
    if (!stream.isEnvelope) throw ApiError.badRequest('That income stream is not marked as an envelope.');
  }

  const expense = await personalService.createExpense(req.user.personalUid, body);
  res.status(201).json({ success: true, expense });
});

// ── PATCH /api/personal/expenses/:id ────────────────────────────────
const updateExpense = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const body = sanitise(req.body, ['title', 'category', 'date', 'notes']);

  if (body.category && !EXPENSE_CATEGORIES.includes(body.category)) {
    throw ApiError.badRequest(`Invalid expense category: "${body.category}".`);
  }

  const existing = await personalService.getExpense(req.user.personalUid, id);
  if (!existing) throw ApiError.badRequest('Expense not found.');

  await personalService.updateExpense(req.user.personalUid, id, body);
  res.json({ success: true });
});

// ── POST /api/personal/expenses/:id/reimbursement ───────────────────
const toggleReimbursement = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await personalService.getExpense(req.user.personalUid, id);
  if (!existing) throw ApiError.badRequest('Expense not found.');
  if (!existing.isBusinessReimbursement) {
    throw ApiError.badRequest('This expense was not marked as a business reimbursement.');
  }

  await personalService.toggleReimbursementStatus(req.user.personalUid, id);
  res.json({ success: true });
});

// ── DELETE /api/personal/expenses/:id ───────────────────────────────
const deleteExpense = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await personalService.getExpense(req.user.personalUid, id);
  if (!existing) throw ApiError.badRequest('Expense not found.');

  if (existing.receiptUrl) {
    await personalService.deleteReceipt(existing.receiptUrl);
  }

  await personalService.deleteExpense(req.user.personalUid, id);
  res.json({ success: true });
});

// ── POST /api/personal/expenses/:id/receipt ─────────────────────────
const uploadReceiptHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!req.file) throw ApiError.badRequest('No file uploaded. Field name must be "receipt".');

  const existing = await personalService.getExpense(req.user.personalUid, id);
  if (!existing) throw ApiError.badRequest('Expense not found.');

  if (existing.receiptUrl) {
    await personalService.deleteReceipt(existing.receiptUrl);
  }

  const key = await personalService.uploadReceipt(
    req.user.personalUid, 'expense', id, req.file.buffer, req.file.originalname, req.file.mimetype
  );
  await personalService.updateExpense(req.user.personalUid, id, { receiptUrl: key });
  res.json({ success: true, receiptUrl: key });
});

module.exports = {
  getExpenses, createExpense, updateExpense, deleteExpense,
  toggleReimbursement, uploadReceiptHandler, uploadMiddleware,
};
