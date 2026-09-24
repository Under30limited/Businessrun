/**
 * controllers/sales.controller.js
 *
 * Sales Day Book — record sales, auto-deduct inventory, fetch history.
 *
 * All routes protected — valid JWT cookie required.
 *
 * Routes:
 *   GET  /api/sales          — fetch all sales (optional ?from=&to= date filter)
 *   POST /api/sales          — record a sale + deduct inventory stock server-side
 *
 * WHY stock deduction happens here (not in inventory controller):
 *   A sale and its stock deduction are one atomic business event.
 *   Handling both in one endpoint means if the stock update fails,
 *   the sale record is not written either — no orphaned data.
 *   The inventory PATCH endpoint is reused internally (same logic,
 *   no duplicate code) by calling firebaseService.updateInventoryItem.
 */

'use strict';

const asyncHandler    = require('../utils/asyncHandler');
const ApiError        = require('../utils/ApiError');
const { sanitise, requireFields } = require('../utils/sanitise');
const firebaseService = require('../services/db.service');

// ── GET /api/sales ────────────────────────────────────────────────
/**
 * Returns all sales for the logged-in user, newest first.
 * Optional query params:
 *   ?from=2024-01-01   ISO date string — start of range
 *   ?to=2024-01-31     ISO date string — end of range
 *
 * Response: { success: true, sales: [...] }
 */
const getSales = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  let fromDate, toDate;
  if (req.query.from) {
    fromDate = new Date(req.query.from);
    if (isNaN(fromDate)) throw ApiError.badRequest('Invalid "from" date format. Use ISO format: YYYY-MM-DD.');
    fromDate.setHours(0, 0, 0, 0);
  }
  if (req.query.to) {
    toDate = new Date(req.query.to);
    if (isNaN(toDate)) throw ApiError.badRequest('Invalid "to" date format. Use ISO format: YYYY-MM-DD.');
    toDate.setHours(23, 59, 59, 999);
  }

  const sales = await firebaseService.getSales(uid, fromDate, toDate);
  res.json({ success: true, sales });
});

// ── POST /api/sales ───────────────────────────────────────────────
/**
 * Records a sale and atomically deducts stock from the inventory item.
 *
 * Flow:
 *   1. Validate request body
 *   2. Fetch the inventory item to verify it exists and has enough stock
 *   3. Write the sale record to Firestore
 *   4. Deduct the quantity from inventory via updateInventoryItem
 *      (same service function used by PATCH /api/inventory/:id)
 *   5. Return the saved sale + updated inventory quantity
 *
 * Body:
 *   { inventoryItemId, itemName, unitPrice, salePrice, quantity }
 *
 * Response:
 *   { success: true, sale: {...}, updatedQuantity: number }
 */
const logSale = asyncHandler(async (req, res) => {
  const uid  = req.user.uid;
  const body = sanitise(req.body, [
    'items', 'buyerName', 'buyerContact', 'businessName',
    'pointOfSale', 'paymentStatus', 'paymentMethod', 'deliveryDetails',
    'recordedBy', 'description',
  ]);
  requireFields(body, ['items']);

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw ApiError.badRequest('At least one item is required.');
  }

  const VALID_POS     = ['Walk-in', 'Online', 'Website', 'WhatsApp', 'Instagram', 'Twitter', 'Other'];
  const VALID_PAYMENT = ['Paid', 'Credit'];
  const VALID_METHODS = ['Cash', 'Bank Transfer', 'POS', 'Cheque', 'Crypto', 'Other'];

  const buyerName      = (body.buyerName      || '').trim();
  const buyerContact   = (body.buyerContact   || '').trim();
  const businessName   = (body.businessName   || '').trim();
  const pointOfSale    = VALID_POS.includes(body.pointOfSale)     ? body.pointOfSale    : 'Walk-in';
  const paymentStatus  = VALID_PAYMENT.includes(body.paymentStatus) ? body.paymentStatus : 'Paid';
  const deliveryDetails = (body.deliveryDetails || '').trim();
  const paymentMethod   = VALID_METHODS.includes(body.paymentMethod) ? body.paymentMethod : 'Cash';
  const recordedBy      = (body.recordedBy || '').trim(); // staff member who recorded the sale
  const description     = (body.description || '').trim(); // optional internal note — log only, never on receipt

  // ── Validate each line item ───────────────────────────────────────
  // Each line is either:
  //   • An inventory line  — has inventoryItemId, stock is checked/deducted
  //   • A custom line      — isCustom: true, no inventoryItemId, no stock effect
  //     used for sales of goods/services not tracked in inventory
  const validatedItems = body.items.map((line, idx) => {
    const quantity  = parseInt(line.quantity,  10);
    const salePrice = parseFloat(line.salePrice);
    const isCustom  = !!line.isCustom || !line.inventoryItemId;

    if (!isCustom && !line.inventoryItemId) throw ApiError.badRequest(`Item ${idx + 1}: inventoryItemId is required.`);
    if (isCustom && !(line.itemName || '').trim())  throw ApiError.badRequest(`Item ${idx + 1}: item name is required for a custom item.`);
    if (isNaN(quantity)  || quantity  <= 0) throw ApiError.badRequest(`Item ${idx + 1}: quantity must be a positive integer.`);
    if (isNaN(salePrice) || salePrice <  0) throw ApiError.badRequest(`Item ${idx + 1}: salePrice must be a positive number.`);

    const unitPrice = isCustom ? salePrice : parseFloat(line.unitPrice);
    if (!isCustom && (isNaN(unitPrice) || unitPrice < 0)) throw ApiError.badRequest(`Item ${idx + 1}: unitPrice must be a positive number.`);

    return {
      _lineKey:        String(idx),
      inventoryItemId: isCustom ? '' : line.inventoryItemId,
      itemName:        (line.itemName || '').trim(),
      isCustom,
      unitPrice:       isNaN(unitPrice) ? salePrice : unitPrice,
      salePrice,
      quantity,
      totalAmount:     parseFloat((salePrice * quantity).toFixed(2)),
    };
  });

  // ── Fetch all inventory items once — validate stock for inventory lines only ─
  const inventoryItems = await firebaseService.getInventoryItems(uid);
  const stockUpdates   = []; // { id, newQuantity }

  for (const line of validatedItems) {
    if (line.isCustom) continue; // no stock effect for custom items
    const inv = inventoryItems.find(i => i.id === line.inventoryItemId);
    if (!inv) throw ApiError.badRequest(`"${line.itemName}" not found in inventory. It may have been deleted.`);
    if (inv.quantity < line.quantity) {
      throw ApiError.badRequest(
        `Insufficient stock for "${line.itemName}". ` +
        `Available: ${inv.quantity}, requested: ${line.quantity}.`
      );
    }
    stockUpdates.push({ id: line.inventoryItemId, newQuantity: inv.quantity - line.quantity });
  }

  const grandTotal = validatedItems.reduce((s, l) => s + l.totalAmount, 0);

  // ── Write sale record ─────────────────────────────────────────────
  const firstInventoryLine = validatedItems.find(l => !l.isCustom);
  const sale = await firebaseService.recordSale(uid, {
    items:           validatedItems,
    buyerName,
    buyerContact,
    businessName,
    pointOfSale,
    paymentStatus,
    paymentMethod,
    deliveryDetails,
    recordedBy,
    description,
    totalAmount:     parseFloat(grandTotal.toFixed(2)),
    // Legacy flat fields — backwards compat with existing records
    // (only meaningful when at least one inventory line exists)
    inventoryItemId: firstInventoryLine ? firstInventoryLine.inventoryItemId : '',
    itemName:        validatedItems.length === 1 ? validatedItems[0].itemName : `${validatedItems.length} items`,
    unitPrice:       firstInventoryLine ? firstInventoryLine.unitPrice : (validatedItems[0]?.unitPrice || 0),
    salePrice:       validatedItems[0]?.salePrice || 0,
    quantity:        validatedItems.reduce((s, l) => s + l.quantity, 0),
  });

  // ── Deduct stock for every inventory line item ─────────────────────
  await Promise.all(
    stockUpdates.map(({ id, newQuantity }) =>
      firebaseService.updateInventoryItem(uid, id, { quantity: newQuantity })
    )
  );

  // Return sale + stock updates so frontend can update all items at once
  res.status(201).json({
    success:      true,
    sale,
    stockUpdates, // [{ id, newQuantity }]
  });
});


// ── PATCH /api/sales/:id ──────────────────────────────────────────
/**
 * Updates editable fields on a sale record.
 * Accepts: buyerName, buyerContact, businessName, pointOfSale,
 *          paymentStatus, paymentMethod, deliveryDetails
 * Does NOT update items or stock — those are immutable after recording.
 *
 * Response: { success: true }
 */
const updateSale = asyncHandler(async (req, res) => {
  const uid    = req.user.uid;
  const saleId = req.params.id;
  if (!saleId) throw ApiError.badRequest('Sale id is required.');

  const VALID_POS     = ['Walk-in', 'Online', 'Website', 'WhatsApp', 'Instagram', 'Twitter', 'Other'];
  const VALID_PAYMENT = ['Paid', 'Credit'];
  const VALID_METHODS = ['Cash', 'Bank Transfer', 'POS', 'Cheque', 'Crypto', 'Other'];

  const allowed = sanitise(req.body, [
    'buyerName', 'buyerContact', 'businessName',
    'pointOfSale', 'paymentStatus', 'paymentMethod', 'deliveryDetails',
    'recordedBy', 'items', 'totalAmount', 'description',
  ]);

  const updates = {};
  if (allowed.buyerName       !== undefined) updates.buyerName       = (allowed.buyerName || '').trim();
  if (allowed.buyerContact    !== undefined) updates.buyerContact    = (allowed.buyerContact || '').trim();
  if (allowed.businessName    !== undefined) updates.businessName    = (allowed.businessName || '').trim();
  if (allowed.deliveryDetails !== undefined) updates.deliveryDetails = (allowed.deliveryDetails || '').trim();
  if (allowed.recordedBy      !== undefined) updates.recordedBy      = (allowed.recordedBy || '').trim();
  if (allowed.description     !== undefined) updates.description     = (allowed.description || '').trim();
  if (allowed.pointOfSale   && VALID_POS.includes(allowed.pointOfSale))       updates.pointOfSale   = allowed.pointOfSale;
  if (allowed.paymentStatus && VALID_PAYMENT.includes(allowed.paymentStatus)) updates.paymentStatus = allowed.paymentStatus;
  if (allowed.paymentMethod && VALID_METHODS.includes(allowed.paymentMethod)) updates.paymentMethod = allowed.paymentMethod;

  // Items and total — validate if provided
  if (Array.isArray(allowed.items) && allowed.items.length > 0) {
    const validatedItems = allowed.items.map((l, idx) => {
      const quantity  = parseInt(l.quantity, 10);
      const salePrice = parseFloat(l.salePrice);
      if (isNaN(quantity)  || quantity  <= 0) throw ApiError.badRequest(`Item ${idx + 1}: quantity must be a positive integer.`);
      if (isNaN(salePrice) || salePrice <  0) throw ApiError.badRequest(`Item ${idx + 1}: salePrice must be a positive number.`);
      return { ...l, quantity, salePrice, totalAmount: parseFloat((salePrice * quantity).toFixed(2)) };
    });
    updates.items       = validatedItems;
    updates.totalAmount = parseFloat(validatedItems.reduce((s, l) => s + l.totalAmount, 0).toFixed(2));
    // Keep legacy flat fields in sync for backwards compat
    updates.quantity    = validatedItems.reduce((s, l) => s + l.quantity, 0);
    updates.salePrice   = validatedItems[0].salePrice;
    updates.itemName    = validatedItems.length === 1 ? validatedItems[0].itemName : `${validatedItems.length} items`;
  }

  if (Object.keys(updates).length === 0) throw ApiError.badRequest('No valid fields to update.');

  await firebaseService.updateSale(uid, saleId, updates);
  res.json({ success: true });
});

// ── DELETE /api/sales/:id ─────────────────────────────────────────
/**
 * Sale Return — full or partial.
 *
 * Body (optional):
 *   { lineKeys: string[] }   — return only these line items.
 *                               Omit to return the entire sale (legacy behaviour).
 *
 * Response:
 *   { success: true, deleted: boolean, sale: Object|null, stockUpdates: [...] }
 *   deleted=true  → the sale record was removed entirely
 *   deleted=false → the sale record was updated with the remaining
 *                    (non-returned) line items; `sale` is the updated record
 */
const deleteSale = asyncHandler(async (req, res) => {
  const uid    = req.user.uid;
  const saleId = req.params.id;
  if (!saleId) throw ApiError.badRequest('Sale id is required.');

  const body     = sanitise(req.body || {}, ['lineKeys']);
  const lineKeys = Array.isArray(body.lineKeys) ? body.lineKeys.map(String) : undefined;

  const result = await firebaseService.deleteSale(uid, saleId, lineKeys);
  res.json({ success: true, ...result });
});

module.exports = { getSales, logSale, updateSale, deleteSale };
