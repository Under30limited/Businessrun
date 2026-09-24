/**
 * controllers/personalIncome.controller.js
 *
 * Income streams — salary, consulting, dividends, etc. An income
 * stream can be marked isEnvelope: true, in which case linked
 * expenses (see personalExpenses.controller.js) deduct from its
 * amountSpent atomically — this controller never touches
 * amountSpent/fundedCategories directly (personal.service.js's
 * updateIncome already blocks that at the service layer too).
 *
 * Routes:
 *   GET    /api/personal/income              — list all income streams
 *   POST   /api/personal/income              — create a stream (credits its linked account, if any)
 *   PATCH  /api/personal/income/:id          — update a stream's fields
 *   DELETE /api/personal/income/:id          — delete (reverses its account credit)
 *   POST   /api/personal/income/:id/receipt  — attach a receipt file
 */

'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError      = require('../utils/ApiError');
const { sanitise, requireFields } = require('../utils/sanitise');
const personalService = require('../services/personal.service');
const multer          = require('multer');
const { INCOME_STREAM_TYPES, INCOME_FREQUENCIES, CURRENCIES } = require('../config/personalOptions');

// ── Multer — same in-memory, size-capped pattern as inventory image
// upload, widened to also accept PDF since receipts are often a PDF
// exported from a bank/fintech app.
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter(req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError(400, 'Only JPEG, PNG, WebP images or a PDF are accepted for a receipt.'));
    }
  },
});
const uploadMiddleware = upload.single('receipt'); // field name must be 'receipt'

// ── GET /api/personal/income ────────────────────────────────────────
const getIncome = asyncHandler(async (req, res) => {
  const streams = await personalService.getIncomeStreams(req.user.personalUid);
  res.json({ success: true, income: streams });
});

// ── POST /api/personal/income ───────────────────────────────────────
const createIncome = asyncHandler(async (req, res) => {
  const body = sanitise(req.body, [
    'title', 'type', 'amount', 'currency', 'frequency', 'accountId', 'accountName',
    'isEnvelope', 'notes', 'dateReceived', 'tag',
  ]);
  requireFields(body, ['title', 'type', 'amount', 'currency', 'frequency']);

  if (!INCOME_STREAM_TYPES.includes(body.type)) {
    throw ApiError.badRequest(`Invalid income type: "${body.type}".`);
  }
  if (!INCOME_FREQUENCIES.includes(body.frequency)) {
    throw ApiError.badRequest(`Invalid frequency: "${body.frequency}".`);
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

  const income = await personalService.createIncome(req.user.personalUid, body);
  res.status(201).json({ success: true, income });
});

// ── PATCH /api/personal/income/:id ──────────────────────────────────
const updateIncome = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const body = sanitise(req.body, ['title', 'type', 'frequency', 'notes', 'dateReceived', 'tag', 'isEnvelope']);

  if (body.type && !INCOME_STREAM_TYPES.includes(body.type)) {
    throw ApiError.badRequest(`Invalid income type: "${body.type}".`);
  }
  if (body.frequency && !INCOME_FREQUENCIES.includes(body.frequency)) {
    throw ApiError.badRequest(`Invalid frequency: "${body.frequency}".`);
  }

  const existing = await personalService.getIncomeStream(req.user.personalUid, id);
  if (!existing) throw ApiError.badRequest('Income stream not found.');

  await personalService.updateIncome(req.user.personalUid, id, body);
  res.json({ success: true });
});

// ── DELETE /api/personal/income/:id ─────────────────────────────────
const deleteIncome = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await personalService.getIncomeStream(req.user.personalUid, id);
  if (!existing) throw ApiError.badRequest('Income stream not found.');

  if (existing.receiptUrl) {
    await personalService.deleteReceipt(existing.receiptUrl);
  }

  await personalService.deleteIncome(req.user.personalUid, id);
  res.json({ success: true });
});

// ── POST /api/personal/income/:id/receipt ───────────────────────────
const uploadReceiptHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!req.file) throw ApiError.badRequest('No file uploaded. Field name must be "receipt".');

  const existing = await personalService.getIncomeStream(req.user.personalUid, id);
  if (!existing) throw ApiError.badRequest('Income stream not found.');

  if (existing.receiptUrl) {
    await personalService.deleteReceipt(existing.receiptUrl); // replace, don't accumulate orphans
  }

  const key = await personalService.uploadReceipt(
    req.user.personalUid, 'income', id, req.file.buffer, req.file.originalname, req.file.mimetype
  );
  await personalService.updateIncome(req.user.personalUid, id, { receiptUrl: key });
  res.json({ success: true, receiptUrl: key });
});

module.exports = { getIncome, createIncome, updateIncome, deleteIncome, uploadReceiptHandler, uploadMiddleware };
