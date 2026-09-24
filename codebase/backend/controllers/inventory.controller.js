/**
 * controllers/inventory.controller.js
 *
 * Inventory management — items + image uploads via AWS S3.
 *
 * All routes protected — valid JWT cookie required.
 * uid comes from req.user set by protect middleware.
 *
 * Routes:
 *   GET    /api/inventory          — load all items for the user
 *   POST   /api/inventory          — add a new item (with optional image)
 *   PATCH  /api/inventory/:id      — update quantity / price / name
 *   DELETE /api/inventory/:id      — delete item + S3 image
 *
 * Image upload strategy:
 *   multer memoryStorage() buffers the file in RAM (never written to disk).
 *   The buffer is uploaded directly to S3 via db.service's uploadInventoryImage.
 *   The presigned URL returned is stored as image_url on the item record.
 *   Max file size: 5MB. Accepted types: image/jpeg, image/png, image/webp.
 */

'use strict';

const asyncHandler    = require('../utils/asyncHandler');
const ApiError        = require('../utils/ApiError');
const { sanitise, requireFields } = require('../utils/sanitise');
const firebaseService = require('../services/db.service');
const { getEffectivePlan } = require('../services/subscription.service');
const { v4: uuidv4 }  = require('uuid');
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

// Must match InventoryDashboard.jsx's LOW_STOCK constant — kept in
// sync manually since one lives in the frontend bundle and one here;
// if you change one, change the other.
const LOW_STOCK_THRESHOLD = 5;

// ── GET /api/inventory/low-stock-count ────────────────────────────
/**
 * A lightweight count-only endpoint for the dashboard-wide low-stock
 * banner (see LowStockBanner.jsx) — deliberately NOT the full item
 * list, so a banner that needs to check this from any tab doesn't
 * have to fetch every inventory item just to know a count.
 */
const getLowStockCount = asyncHandler(async (req, res) => {
  const uid   = req.user.uid;
  const items = await firebaseService.getInventoryItems(uid);
  const count = items.filter(i => i.quantity <= LOW_STOCK_THRESHOLD).length;
  res.json({ success: true, count });
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

  // Duplicate check — reject if an item with the same name (case-insensitive)
  // already exists in this user's inventory. Prevents accidental double entries
  // where a user adds "Ankara Set" twice instead of editing the existing one.
  const existingItems = await firebaseService.getInventoryItems(uid);
  const nameLower     = body.name.trim().toLowerCase();
  const duplicate     = existingItems.find(i => i.name.trim().toLowerCase() === nameLower);
  if (duplicate) {
    throw ApiError.badRequest(
      `"${body.name.trim()}" already exists in your inventory. ` +
      `Edit the existing item to update its price, stock, or details.`
    );
  }

  // Plan item cap — grandfathers existing items over a lower tier's
  // limit (same policy as elsewhere: never block/hide existing data,
  // only block the NEXT addition once at or over the cap). null means
  // unlimited.
  const { plan } = await getEffectivePlan(uid);
  if (plan.limits.inventoryItems !== null && existingItems.length >= plan.limits.inventoryItems) {
    throw ApiError.badRequest(
      `Your current plan (${plan.name}) allows up to ${plan.limits.inventoryItems} inventory items. ` +
      `Upgrade to add more, or remove an existing item first.`
    );
  }

  // Pre-generate the item id so we can use it in the S3 storage path
  // before the DB record is written — saveInventoryItem below will
  // honor this same id rather than generating a new one.
  const itemId = uuidv4();

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
  getLowStockCount,
  addItem,
  updateItem,
  deleteItem,
  getItemHistory,
};
