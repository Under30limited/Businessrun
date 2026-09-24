/**
 * controllers/reports.controller.js
 *
 * AI-generated business reports — persistent, timestamped.
 *
 * Routes:
 *   GET    /api/reports/:type          → list all saved reports of a type
 *   POST   /api/reports/:type/generate → generate + save a new report (5/day limit)
 *   DELETE /api/reports/:id            → delete a saved report
 *
 * Types: 'sales' | 'inventory'
 * All routes require valid JWT cookie (protect middleware).
 */

'use strict';

const asyncHandler    = require('../utils/asyncHandler');
const ApiError        = require('../utils/ApiError');
const { sanitise }    = require('../utils/sanitise');
const firebaseService = require('../services/db.service');
const geminiService   = require('../services/gemini.service');

const VALID_TYPES  = ['sales', 'inventory'];
const DAILY_LIMIT  = 5;

// ── GET /api/reports/:type ────────────────────────────────────────
const getReports = asyncHandler(async (req, res) => {
  const uid  = req.user.uid;
  const type = req.params.type;
  if (!VALID_TYPES.includes(type)) throw ApiError.badRequest(`Invalid report type. Must be one of: ${VALID_TYPES.join(', ')}.`);

  const reports = await firebaseService.getReports(uid, type);
  res.json({ success: true, reports });
});

// ── POST /api/reports/:type/generate ─────────────────────────────
const generateReport = asyncHandler(async (req, res) => {
  const uid  = req.user.uid;
  const type = req.params.type;
  if (!VALID_TYPES.includes(type)) throw ApiError.badRequest(`Invalid report type.`);

  // ── 5-per-24h rate limit (stored in Firestore, not per-IP) ───
  const usedToday = await firebaseService.countReportsToday(uid);
  if (usedToday >= DAILY_LIMIT) {
    throw ApiError.tooManyRequests(
      `You have generated ${DAILY_LIMIT} reports in the last 24 hours. ` +
      `Your limit resets 24 hours after your first report today.`
    );
  }

  const body = sanitise(req.body, ['fromDate', 'toDate', 'language']);
  const { fromDate, toDate, language = 'English' } = body;

  if (fromDate && !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) throw ApiError.badRequest('fromDate must be YYYY-MM-DD.');
  if (toDate   && !/^\d{4}-\d{2}-\d{2}$/.test(toDate))   throw ApiError.badRequest('toDate must be YYYY-MM-DD.');

  // ── Fetch business profile ──────────────────────────────────────
  // uid here is businessUid (see middleware/auth.js) — profile fields
  // (businessName/stage/salesChannel/headache/revenue) live in
  // br-businesses, NOT br-users (which is pure identity post
  // multi-tenant split — see services/db.service.js's table-layout
  // comment). getUserByUid(businessUid) would return null/undefined
  // for all of these even for a real business.
  const businessDoc = await firebaseService.getBusiness(uid);
  const profile = {
    businessName:  businessDoc?.businessName  || '',
    stage:         businessDoc?.stage         || '',
    salesChannel:  businessDoc?.salesChannel  || '',
    headache:      businessDoc?.headache      || '',
    revenue:       businessDoc?.revenue       || '',
  };

  let result;

  if (type === 'sales') {
    const sales = await firebaseService.getSales(uid, fromDate || null, toDate || null);
    if (!sales || sales.length === 0) throw ApiError.badRequest('No sales records found for this period. Log some sales first, or widen your date range.');
    result = await geminiService.generateSalesReport({ profile, sales, fromDate, toDate, language });
  }

  if (type === 'inventory') {
    const [inventory, sales] = await Promise.all([
      firebaseService.getInventoryItems(uid),
      firebaseService.getSales(uid, fromDate || null, toDate || null),
    ]);
    if (!inventory || inventory.length === 0) throw ApiError.badRequest('No inventory items found. Add some items to your inventory first.');
    result = await geminiService.generateInventoryReport({ profile, inventory, sales, fromDate, toDate, language });
  }

  // ── Save to Firestore ─────────────────────────────────────────
  const saved = await firebaseService.saveReport(uid, {
    type,
    title:    result.title,
    content:  result.content,
    fromDate: fromDate || null,
    toDate:   toDate   || null,
  });

  res.status(201).json({
    success:    true,
    report:     saved,
    remaining:  DAILY_LIMIT - usedToday - 1,
  });
});

// ── DELETE /api/reports/:id ───────────────────────────────────────
const deleteReport = asyncHandler(async (req, res) => {
  const uid      = req.user.uid;
  const reportId = req.params.id;
  if (!reportId) throw ApiError.badRequest('Report id is required.');
  await firebaseService.deleteReport(uid, reportId);
  res.json({ success: true });
});

module.exports = { getReports, generateReport, deleteReport };
