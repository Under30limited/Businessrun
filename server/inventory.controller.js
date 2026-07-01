/**
 * controllers/inventory.controller.js
 *
 * Inventory management — items + image uploads via Firebase Storage.
 *
 * All routes protected — valid JWT cookie required.
 * uid comes from req.user set by protect middleware.
 *
 * Routes:
 *   GET    /api/inventory          — load all items for the user
 *   POST   /api/inventory          — add a new item (with optional image)
 *   PATCH  /api/inventory/:id      — update quantity / price / name
 *   DELETE /api/inventory/:id      — delete item + Storage image
 *
 * Image upload strategy:
 *   multer memoryStorage() buffers the file in RAM (never written to disk).
 *   The buffer is passed directly to Firebase Storage Admin SDK via file.save().
 *   The signed URL returned is stored in Firestore as image_url on the item.
 *   Max file size: 5MB. Accepted types: image/jpeg, image/png, image/webp.
 */

'use strict';

const asyncHandler    = require('../utils/asyncHandler');
const ApiError        = require('../utils/ApiError');
const { sanitise, requireFields } = require('../utils/sanitise');
const firebaseService = require('../services/firebase.service');
const multer          = require('multer');

// ── Multer — in-memory storage, 5MB limit, images only ────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter(req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError(400, 'Only JPEG, PNG, and WebP images are accepted.'));
    }
  },
});

// Export the multer middleware so the router can apply it per-route
const uploadMiddleware = upload.single('image'); // field name must be 'image'

// ── GET /api/inventory ────────────────────────────────────────────
/**
 * Returns all inventory items for the logged-in user.
 * Called silently on dashboard load — items pre-populate the UI.
 *
 * Response: { success: true, items: [...] }
 */
const getItems = asyncHandler(async (req, res) => {
  const uid   = req.user.uid;
  const items = await firebaseService.getInventoryItems(uid);
  res.json({ success: true, items });
});

// ── POST /api/inventory ───────────────────────────────────────────
/**
 * Adds a new inventory item.
 * Accepts multipart/form-data so an image can be uploaded alongside
 * the text fields in a single request.
 *
 * Form fields: name, category, unit_price, quantity
 * File field:  image (optional)
 *
 * Flow:
 *   1. Validate text fields
 *   2. Generate a Firestore doc ref to get the id before writing
 *      (we need the id to name the Storage path)
 *   3. Upload image to Storage if provided → get signed URL
 *   4. Save item doc to Firestore with image_url
 *
 * Response: { success: true, item: { id, name, ... , image_url } }
 */
const addItem = asyncHandler(async (req, res) => {
  const uid  = req.user.uid;
  const body = sanitise(req.body, ['name', 'category', 'unit_price', 'cost_price', 'quantity', 'serial_number']);
  requireFields(body, ['name', 'unit_price', 'quantity']);

  const unit_price  = parseFloat(body.unit_price);
  const cost_price  = body.cost_price ? parseFloat(body.cost_price) : 0;
  const quantity    = parseInt(body.quantity, 10);

  if (isNaN(unit_price) || unit_price < 0) throw ApiError.badRequest('unit_price must be a positive number.');
  if (isNaN(cost_price) || cost_price < 0) throw ApiError.badRequest('cost_price must be a positive number.');
  if (isNaN(quantity)   || quantity   < 0) throw ApiError.badRequest('quantity must be a positive integer.');

  // Pre-generate the Firestore item id so we can use it in the Storage path
  const itemId = require('../config/firebase').db
    .collection('inventory').doc(uid)
    .collection('items').doc().id;

  // Upload image if provided
  let image_url  = null;
  let image_ext  = null;

  if (req.file) {
    image_ext = req.file.originalname.split('.').pop().toLowerCase() || 'jpg';
    image_url = await firebaseService.uploadInventoryImage(
      uid,
      itemId,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );
  }

  const item = await firebaseService.saveInventoryItem(uid, {
    id:            itemId,
    name:          body.name.trim(),
    category:      (body.category || '').trim(),
    unit_price,
    cost_price,
    quantity,
    serial_number: (body.serial_number || '').trim(),
    image_url,
    image_ext,
  });

  res.status(201).json({ success: true, item });
});

// ── PATCH /api/inventory/:id ──────────────────────────────────────
/**
 * Updates editable fields on an existing item.
 * Supports partial updates — only provided fields are changed.
 * Does not handle image replacement (delete + re-add for that).
 *
 * Body (all optional): { name, category, unit_price, quantity }
 * Response: { success: true }
 */
const updateItem = asyncHandler(async (req, res) => {
  const uid    = req.user.uid;
  const itemId = req.params.id;
  if (!itemId) throw ApiError.badRequest('Item id is required.');

  const body    = sanitise(req.body, ['name', 'category', 'unit_price', 'cost_price', 'quantity', 'serial_number']);
  const updates = {};

  if (body.name          !== undefined) updates.name          = body.name.trim();
  if (body.category      !== undefined) updates.category      = body.category.trim();
  if (body.serial_number !== undefined) updates.serial_number = body.serial_number.trim();
  if (body.unit_price    !== undefined) {
    const p = parseFloat(body.unit_price);
    if (isNaN(p) || p < 0) throw ApiError.badRequest('unit_price must be a positive number.');
    updates.unit_price = p;
  }
  if (body.cost_price !== undefined) {
    const c = parseFloat(body.cost_price);
    if (isNaN(c) || c < 0) throw ApiError.badRequest('cost_price must be a positive number.');
    updates.cost_price = c;
  }
  if (body.quantity !== undefined) {
    const q = parseInt(body.quantity, 10);
    if (isNaN(q) || q < 0) throw ApiError.badRequest('quantity must be a positive integer.');
    updates.quantity = q;
  }

  if (Object.keys(updates).length === 0) throw ApiError.badRequest('No valid fields provided for update.');

  await firebaseService.updateInventoryItem(uid, itemId, updates);
  res.json({ success: true });
});

// ── DELETE /api/inventory/:id ─────────────────────────────────────
/**
 * Deletes an item from Firestore and its image from Firebase Storage.
 * The image_ext query param tells us the file extension in Storage.
 * If the item had no image, the Storage delete is a safe no-op.
 *
 * Query: ?image_ext=jpg  (optional — omit if item has no image)
 * Response: { success: true }
 */
const deleteItem = asyncHandler(async (req, res) => {
  const uid      = req.user.uid;
  const itemId   = req.params.id;
  const imageExt = req.query.image_ext || null;

  if (!itemId) throw ApiError.badRequest('Item id is required.');

  // Delete Storage image first — if this fails it logs a warning but
  // doesn't block the Firestore delete (non-fatal by design)
  if (imageExt) {
    await firebaseService.deleteInventoryImage(uid, itemId, imageExt);
  }

  await firebaseService.deleteInventoryItem(uid, itemId);
  res.json({ success: true });
});


// ── GET /api/inventory/:id/history ───────────────────────────────
/**
 * Returns the sale history for a specific inventory item.
 * Queries salesDayBook for all sales containing this item's id.
 *
 * Response: { success: true, history: [...] }
 */
const getItemHistory = asyncHandler(async (req, res) => {
  const uid    = req.user.uid;
  const itemId = req.params.id;
  if (!itemId) throw ApiError.badRequest('Item id is required.');

  const history = await firebaseService.getItemSaleHistory(uid, itemId);
  res.json({ success: true, history });
});

module.exports = {
  uploadMiddleware,
  getItems,
  addItem,
  updateItem,
  deleteItem,
  getItemHistory,
};
