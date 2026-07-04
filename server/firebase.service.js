/**
 * services/firebase.service.js
 *
 * All Firestore database operations for BusinessRun.
 * Controllers never call Firestore directly — they call these functions.
 *
 * Collections managed here:
 *   users                — GYB onboarding profiles (one doc per user)
 *   nominations          — Top 30 nominations
 *   subscribers          — Capital Club + resource requests
 *   under30applications  — Under30Women mentorship applications
 *   advisorSessions      — AI Advisor conversation history
 *
 * Every write uses server timestamps (admin.firestore.FieldValue.serverTimestamp())
 * rather than Date objects from the frontend. This ensures all timestamps
 * are consistent, UTC, and cannot be spoofed by client clocks.
 *
 * Exported functions:
 *
 *   -- Users / GYB --
 *   createGybSession(sessionId, data)
 *   updateGybSession(sessionId, data)
 *   promoteSessionToUser(sessionId, uid, passwordData)
 *   getUserByUid(uid)
 *   getUserByEmail(email)
 *   getUserBySessionId(sessionId)
 *
 *   -- Nominations --
 *   createNomination(data)
 *
 *   -- Subscribers --
 *   createSubscriber(data)
 *   subscriberExists(email, type)
 *
 *   -- Under30 --
 *   createUnder30Application(data)
 *
 *   -- Advisor Sessions --
 *   getAdvisorSession(sessionId)
 *   upsertAdvisorSession(sessionId, userId, messages)
 */

'use strict';

const { db, admin, storage } = require('../config/firebase');
const ApiError       = require('../utils/ApiError');

const FieldValue = admin.firestore.FieldValue;

// ── Collection name constants ─────────────────────────────────────
const COLLECTIONS = {
  USERS:         'users',
  NOMINATIONS:   'nominations',
  SUBSCRIBERS:   'subscribers',
  UNDER30:       'under30applications',
  ADVISOR:       'advisorSessions',
  CFO_ENTRIES:   'cfoEntries',      // sub-keyed by uid + tool name
  INVENTORY:     'inventory',        // sub-keyed by uid → items sub-collection
  SALES_DAY_BOOK:'salesDayBook',    // sub-keyed by uid → sales sub-collection
  DAY_LOG:       'dayLog',          // sub-keyed by uid → entries sub-collection
};

// ─────────────────────────────────────────────────────────────────
// USERS / GYB ONBOARDING
// ─────────────────────────────────────────────────────────────────

/**
 * createGybSession
 * Called at GYB Step 1 (name, business, email).
 * Creates a new Firestore document keyed by sessionId.
 * The document is temporary — it gets promoted to a real user doc
 * (keyed by Firebase Auth UID) when the user sets their password.
 *
 * @param {string} sessionId  Temporary session key from the frontend
 * @param {Object} data       { fullName, businessName, email, source }
 */
async function createGybSession(sessionId, data) {
  const ref = db.collection(COLLECTIONS.USERS).doc(sessionId);

  // Check if a session with this ID already exists (duplicate submission)
  const existing = await ref.get();
  if (existing.exists) {
    // Idempotent — update rather than throw
    await ref.update({
      fullName:     data.fullName,
      businessName: data.businessName,
      email:        data.email,
      updatedAt:    FieldValue.serverTimestamp(),
    });
    return;
  }

  await ref.set({
    sessionId,
    fullName:        data.fullName,
    businessName:    data.businessName,
    email:           data.email,
    onboardingStep:  1,
    completed:       false,
    profileSaved:    false,
    source:          data.source || 'businessrun-gyb',
    createdAt:       FieldValue.serverTimestamp(),
    updatedAt:       FieldValue.serverTimestamp(),
  });
}

/**
 * updateGybSession
 * Called at GYB Steps 2 and 3.
 * Updates the existing session document with new fields.
 * Uses merge:true so existing fields are preserved.
 *
 * @param {string} sessionId
 * @param {Object} data   Fields to update + step number
 */
async function updateGybSession(sessionId, data) {
  const ref = db.collection(COLLECTIONS.USERS).doc(sessionId);

  const existing = await ref.get();
  if (!existing.exists) {
    // Session not found — could be a network retry after step 1 failed silently
    // Create a recovery document so data is not lost
    console.warn(`[Firebase] updateGybSession: session ${sessionId} not found — creating recovery doc`);
    await ref.set({
      sessionId,
      ...data,
      onboardingStep: data.onboardingStep || 2,
      completed:      false,
      profileSaved:   false,
      createdAt:      FieldValue.serverTimestamp(),
      updatedAt:      FieldValue.serverTimestamp(),
    });
    return;
  }

  await ref.update({
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * promoteSessionToUser
 * Called at GYB Step 4 (password set).
 * The temporary sessionId document is copied to a new document
 * keyed by the Firebase Auth UID, then the old doc is deleted.
 * This is the moment the user becomes a permanent, identifiable record.
 *
 * @param {string} sessionId   The temporary document ID
 * @param {string} uid         Firebase Auth UID
 * @param {Object} extraData   { profileSavedAt }
 */
async function promoteSessionToUser(sessionId, uid, extraData = {}) {
  const sessionRef = db.collection(COLLECTIONS.USERS).doc(sessionId);
  const userRef    = db.collection(COLLECTIONS.USERS).doc(uid);

  // Run in a Firestore transaction so both operations succeed or both fail
  await db.runTransaction(async (txn) => {
    const sessionDoc = await txn.get(sessionRef);

    if (!sessionDoc.exists) {
      throw ApiError.notFound(
        `GYB session ${sessionId} not found during promotion.`
      );
    }

    const sessionData = sessionDoc.data();

    // Write permanent user doc keyed by Firebase Auth UID
    txn.set(userRef, {
      ...sessionData,
      uid,
      sessionId,           // keep the original sessionId for reference
      onboardingStep:  4,
      completed:       true,
      profileSaved:    true,
      profileSavedAt:  extraData.profileSavedAt || FieldValue.serverTimestamp(),
      updatedAt:       FieldValue.serverTimestamp(),
    });

    // Delete the temporary session doc
    txn.delete(sessionRef);
  });
}

/**
 * getUserByUid
 * Fetches a user document by Firebase Auth UID.
 *
 * @param {string} uid
 * @returns {Promise<Object|null>}
 */
async function getUserByUid(uid) {
  const doc = await db.collection(COLLECTIONS.USERS).doc(uid).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

/**
 * getUserByEmail
 * Queries the users collection for a document with a matching email.
 * Used when looking up a user before returning their profile on login.
 *
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
async function getUserByEmail(email) {
  const normalised = email.toLowerCase().trim();

  const snapshot = await db
    .collection(COLLECTIONS.USERS)
    .where('email', '==', normalised)
    .where('completed', '==', true)   // only return fully registered users
    .limit(1)
    .get();

  if (snapshot.empty) {
    // Fallback: search without completed filter in case of edge case
    const fallback = await db
      .collection(COLLECTIONS.USERS)
      .where('email', '==', normalised)
      .limit(1)
      .get();
    if (fallback.empty) return null;
    const doc = fallback.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

/**
 * getUserBySessionId
 * Looks up a user document by sessionId field.
 * Useful for verifying a session exists before step updates.
 *
 * @param {string} sessionId
 * @returns {Promise<Object|null>}
 */
async function getUserBySessionId(sessionId) {
  // First try direct doc lookup (session docs are keyed by sessionId)
  const directDoc = await db
    .collection(COLLECTIONS.USERS)
    .doc(sessionId)
    .get();

  if (directDoc.exists) {
    return { id: directDoc.id, ...directDoc.data() };
  }

  // Fall back to a field query (promoted user docs have sessionId as a field)
  const snapshot = await db
    .collection(COLLECTIONS.USERS)
    .where('sessionId', '==', sessionId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

// ─────────────────────────────────────────────────────────────────
// NOMINATIONS
// ─────────────────────────────────────────────────────────────────

/**
 * createNomination
 * Writes a new Top 30 nomination to Firestore.
 * Firestore auto-generates the document ID.
 *
 * @param {Object} data  All nomination form fields (already sanitised)
 * @returns {Promise<{ id: string }>}  The new document ID
 */
async function createNomination(data) {
  const ref = await db.collection(COLLECTIONS.NOMINATIONS).add({
    ...data,
    status:      'Pending',
    submittedAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id };
}

// ─────────────────────────────────────────────────────────────────
// SUBSCRIBERS
// ─────────────────────────────────────────────────────────────────

/**
 * subscriberExists
 * Checks whether an email has already subscribed for a given type.
 * Prevents duplicate entries in the subscribers collection.
 *
 * @param {string} email
 * @param {string} type  'capital-club' | 'resource-request'
 * @returns {Promise<boolean>}
 */
async function subscriberExists(email, type) {
  const snapshot = await db
    .collection(COLLECTIONS.SUBSCRIBERS)
    .where('email', '==', email.toLowerCase().trim())
    .where('type',  '==', type)
    .limit(1)
    .get();

  return !snapshot.empty;
}

/**
 * createSubscriber
 * Writes a new subscriber document.
 * Should be called only after subscriberExists() returns false.
 *
 * @param {Object} data  { email, type, resource, source }
 * @returns {Promise<{ id: string }>}
 */
async function createSubscriber(data) {
  const ref = await db.collection(COLLECTIONS.SUBSCRIBERS).add({
    email:        data.email.toLowerCase().trim(),
    type:         data.type,
    resource:     data.resource || null,
    source:       data.source   || 'businessrun-website',
    subscribedAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id };
}

// ─────────────────────────────────────────────────────────────────
// UNDER30 APPLICATIONS
// ─────────────────────────────────────────────────────────────────

/**
 * createUnder30Application
 * Writes a new Under30Women application to Firestore.
 *
 * @param {Object} data  All Under30App form fields (already sanitised)
 * @returns {Promise<{ id: string }>}
 */
async function createUnder30Application(data) {
  const ref = await db.collection(COLLECTIONS.UNDER30).add({
    ...data,
    status:      'Pending',
    submittedAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id };
}

// ─────────────────────────────────────────────────────────────────
// ADVISOR SESSIONS
// ─────────────────────────────────────────────────────────────────

/**
 * getAdvisorSession
 * Fetches an advisor conversation session by its sessionId.
 *
 * @param {string} sessionId
 * @returns {Promise<Object|null>}
 */
async function getAdvisorSession(sessionId) {
  const doc = await db
    .collection(COLLECTIONS.ADVISOR)
    .doc(sessionId)
    .get();

  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

/**
 * upsertAdvisorSession
 * Creates or updates an advisor conversation session.
 * Each message is appended to the messages array.
 *
 * @param {string}    sessionId
 * @param {string|null} userId   Firebase Auth UID (null for anonymous)
 * @param {Object[]}  messages   Full messages array including new message
 */
async function upsertAdvisorSession(sessionId, userId, messages) {
  const ref = db.collection(COLLECTIONS.ADVISOR).doc(sessionId);

  await ref.set(
    {
      userId,
      messages,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true } // creates if not exists, updates if it does
  );

  // Set createdAt only if this is a new document (merge won't overwrite it
  // if it already exists, but set with merge on a new doc won't set it either)
  const doc = await ref.get();
  if (!doc.data().createdAt) {
    await ref.update({ createdAt: FieldValue.serverTimestamp() });
  }
}


// ─────────────────────────────────────────────────────────────────
// SAVE COMPLETE USER  (called at step 4 — the definitive write)
// ─────────────────────────────────────────────────────────────────

/**
 * saveCompleteUser
 * Writes the complete user profile to Firestore keyed by Firebase Auth UID.
 * Called once at step 4 (password set). This is the authoritative user record.
 * All fields from all onboarding steps are written together atomically.
 *
 * @param {string} uid   Firebase Auth UID
 * @param {Object} data  All profile fields
 */
async function saveCompleteUser(uid, data) {
  const ref = db.collection(COLLECTIONS.USERS).doc(uid);

  await ref.set({
    uid,
    sessionId:      data.sessionId    || '',
    fullName:       data.fullName     || '',
    businessName:   data.businessName || '',
    email:          data.email        || '',
    stage:          data.stage        || '',
    salesChannel:   data.salesChannel || '',
    revenue:        data.revenue      || '',
    headache:       data.headache     || '',
    matchmaking:    data.matchmaking  || '',
    hashedPassword: data.hashedPassword || '',
    source:         data.source       || 'businessrun-gyb',
    onboardingStep: 4,
    completed:      true,
    profileSaved:   true,
    profileSavedAt: data.profileSavedAt || FieldValue.serverTimestamp(),
    createdAt:      FieldValue.serverTimestamp(),
    updatedAt:      FieldValue.serverTimestamp(),
  });

  console.log(`[Firebase] Complete user saved: ${uid} (${data.email})`);
}

/**
 * deleteGybSession
 * Removes the temporary session document after the permanent user doc
 * has been created. Called after saveCompleteUser succeeds.
 * Fire-and-forget — a failed cleanup does not affect the user.
 *
 * @param {string} sessionId
 */
async function deleteGybSession(sessionId) {
  await db.collection(COLLECTIONS.USERS).doc(sessionId).delete();
  console.log(`[Firebase] Session doc deleted: ${sessionId}`);
}


// ─────────────────────────────────────────────────────────────────
// DIGITAL CFO ENTRIES
// ─────────────────────────────────────────────────────────────────
// Each user's entries are stored in cfoEntries/{uid}/tools/{toolName}
// as a single document containing an `entries` array.
// This structure means:
//   - One Firestore read per tool (fast, cheap)
//   - One Firestore write per add/remove (atomic array update)
//   - Easy to load all 4 tools in parallel with Promise.all

/**
 * getCFOEntries
 * Fetches all saved entries for a specific tool for a given user.
 *
 * @param {string} uid       Firebase Auth UID
 * @param {string} toolName  'General Ledger' | 'Income Statement' | etc.
 * @returns {Promise<Object[]>}  Array of entry objects (empty array if none)
 */
async function getCFOEntries(uid, toolName) {
  const ref = db
    .collection(COLLECTIONS.CFO_ENTRIES)
    .doc(uid)
    .collection('tools')
    .doc(toolName);

  const doc = await ref.get();
  if (!doc.exists) return [];
  return doc.data().entries || [];
}

/**
 * getAllCFOEntries
 * Fetches entries for all 4 tools for a given user in one parallel call.
 * Returns an object keyed by tool name — empty arrays for tools with no entries.
 *
 * @param {string} uid
 * @returns {Promise<Object>}  { 'General Ledger': [...], 'Income Statement': [...], ... }
 */
async function getAllCFOEntries(uid) {
  const TOOLS = ['General Ledger', 'Income Statement', 'Balance Sheet', 'Cash Flow'];

  const results = await Promise.all(
    TOOLS.map(tool => getCFOEntries(uid, tool))
  );

  return Object.fromEntries(TOOLS.map((tool, i) => [tool, results[i]]));
}

/**
 * saveCFOEntry
 * Appends a new entry to a user's tool entries array in Firestore.
 * Creates the document if it doesn't exist yet.
 *
 * @param {string} uid      Firebase Auth UID
 * @param {string} toolName Tool name
 * @param {Object} entry    { date, description, amount, category }
 * @returns {Promise<void>}
 */
async function saveCFOEntry(uid, toolName, entry) {
  const ref = db
    .collection(COLLECTIONS.CFO_ENTRIES)
    .doc(uid)
    .collection('tools')
    .doc(toolName);

  const entryWithMeta = {
    ...entry,
    id:        `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    savedAt:   new Date().toISOString(),
  };

  await ref.set(
    {
      uid,
      toolName,
      entries:   FieldValue.arrayUnion(entryWithMeta),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return entryWithMeta;
}

/**
 * deleteCFOEntry
 * Removes a specific entry from a user's tool entries array.
 * Matches by the entry's `id` field.
 *
 * @param {string} uid      Firebase Auth UID
 * @param {string} toolName Tool name
 * @param {string} entryId  The `id` field of the entry to remove
 * @returns {Promise<void>}
 */
async function deleteCFOEntry(uid, toolName, entryId) {
  const ref = db
    .collection(COLLECTIONS.CFO_ENTRIES)
    .doc(uid)
    .collection('tools')
    .doc(toolName);

  const doc = await ref.get();
  if (!doc.exists) return;

  const entries    = doc.data().entries || [];
  const updated    = entries.filter(e => e.id !== entryId);

  await ref.update({
    entries:   updated,
    updatedAt: FieldValue.serverTimestamp(),
  });
}


// ─────────────────────────────────────────────────────────────────
// INVENTORY
// ─────────────────────────────────────────────────────────────────
// Firestore path: inventory/{uid}/items/{itemId}
// Firebase Storage path: inventory/{uid}/{itemId}/{filename}
//
// Each item document contains:
//   { id, name, category, unit_price, quantity, image_url, createdAt, updatedAt }
//
// image_url is a signed Firebase Storage URL — permanent (no expiry)
// because we use getSignedUrl with a far-future date. The URL is
// stored in Firestore so the frontend never calls Storage directly.

/**
 * getInventoryItems
 * Fetches all inventory items for a user, ordered by creation date.
 *
 * @param {string} uid
 * @returns {Promise<Object[]>}
 */
async function getInventoryItems(uid) {
  const snap = await db
    .collection(COLLECTIONS.INVENTORY)
    .doc(uid)
    .collection('items')
    .orderBy('createdAt', 'desc')
    .get();

  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * saveInventoryItem
 * Creates a new inventory item document for a user.
 * image_url is optional — pass null if no image was uploaded.
 *
 * @param {string} uid
 * @param {Object} item  { name, category, unit_price, quantity, image_url }
 * @returns {Promise<Object>}  The saved item including its Firestore id
 */
async function saveInventoryItem(uid, item) {
  const ref = db
    .collection(COLLECTIONS.INVENTORY)
    .doc(uid)
    .collection('items')
    .doc(); // auto-generate id

  const now = new Date();
  const doc = {
    id:             ref.id,
    name:           item.name,
    category:       item.category     || '',
    unit_price:     item.unit_price,
    cost_price:     item.cost_price   || 0,
    quantity:       item.quantity,
    serial_number:  item.serial_number || '',
    image_url:      item.image_url    || null,
    image_ext:      item.image_ext    || null,
    createdAtISO:   now.toISOString(), // ISO timestamp — used by AI agent for days-in-stock and dead stock detection
    createdAt:      FieldValue.serverTimestamp(),
    updatedAt:      FieldValue.serverTimestamp(),
  };

  await ref.set(doc);
  return { ...doc, id: ref.id };
}

/**
 * updateInventoryItem
 * Updates specific fields on an existing inventory item.
 * Does not touch image_url unless explicitly passed.
 *
 * @param {string} uid
 * @param {string} itemId
 * @param {Object} updates  Partial item fields
 */
async function updateInventoryItem(uid, itemId, updates) {
  const ref = db
    .collection(COLLECTIONS.INVENTORY)
    .doc(uid)
    .collection('items')
    .doc(itemId);

  await ref.update({
    ...updates,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * deleteInventoryItem
 * Deletes the Firestore document for an item.
 * Note: The Storage image is deleted separately in the controller
 * before this is called, so the two operations stay in sync.
 *
 * @param {string} uid
 * @param {string} itemId
 */
async function deleteInventoryItem(uid, itemId) {
  await db
    .collection(COLLECTIONS.INVENTORY)
    .doc(uid)
    .collection('items')
    .doc(itemId)
    .delete();
}

/**
 * uploadInventoryImage
 * Uploads a product image buffer to Firebase Storage and returns
 * a permanent public download URL stored in Firestore.
 *
 * Storage path: inventory/{uid}/{itemId}/{originalname}
 *
 * WHY SIGNED URL with far future date instead of makePublic():
 *   makePublic() requires the bucket to have uniform public access
 *   enabled at the GCP level — a security config change that affects
 *   everything in the bucket. Signed URLs are scoped, revocable, and
 *   require no bucket-level policy change. We use year 2099 as the
 *   expiry so the URL is effectively permanent for the app's lifetime.
 *
 * @param {string} uid
 * @param {string} itemId       Firestore document id (pre-generated)
 * @param {Buffer} fileBuffer   File contents from multer memoryStorage
 * @param {string} originalname Original filename from the upload
 * @param {string} mimetype     e.g. 'image/jpeg'
 * @returns {Promise<string>}   Permanent signed download URL
 */
async function uploadInventoryImage(uid, itemId, fileBuffer, originalname, mimetype) {
  const bucket = storage.bucket();
  const ext    = originalname.split('.').pop().toLowerCase();
  const path   = 'inventory/' + uid + '/' + itemId + '/product.' + ext;
  const file   = bucket.file(path);

  await file.save(fileBuffer, {
    metadata: {
      contentType: mimetype,
      cacheControl: 'public, max-age=31536000', // 1 year browser cache
    },
  });

  // Signed URL valid until 2099 — effectively permanent
  const [url] = await file.getSignedUrl({
    action:  'read',
    expires: '01-01-2099',
  });

  return url;
}

/**
 * deleteInventoryImage
 * Deletes the Storage file for an item.
 * Called before deleteInventoryItem so there are no orphaned files.
 *
 * @param {string} uid
 * @param {string} itemId
 * @param {string} originalExt  e.g. 'jpg' — stored on the item doc
 */
async function deleteInventoryImage(uid, itemId, originalExt) {
  try {
    const bucket = storage.bucket();
    const path   = 'inventory/' + uid + '/' + itemId + '/product.' + (originalExt || 'jpg');
    await bucket.file(path).delete();
  } catch (err) {
    // Log but don't throw — the Firestore delete should still proceed
    // even if the Storage file is already gone or the path is wrong.
    console.warn('[Inventory] Storage delete failed (non-fatal):', err.message);
  }
}


// ─────────────────────────────────────────────────────────────────
// SALES DAY BOOK
// ─────────────────────────────────────────────────────────────────
// Firestore path: salesDayBook/{uid}/sales/{saleId}
//
// Each sale document:
//   { id, inventoryItemId, itemName, unitPrice, salePrice,
//     quantity, totalAmount, saleDate, createdAt }
//
// WHY salePrice separate from unitPrice:
//   unitPrice is the listed price at time of sale (for audit trail).
//   salePrice is what the customer actually paid (may differ — discounts).
//   Both are stored so margin erosion is trackable over time.

/**
 * getSales
 * Fetches all sales for a user, ordered newest first.
 * Optionally filtered by date range.
 *
 * @param {string}  uid
 * @param {Date}    [fromDate]  Optional start date filter
 * @param {Date}    [toDate]    Optional end date filter
 * @returns {Promise<Object[]>}
 */
async function getSales(uid, fromDate, toDate) {
  let query = db
    .collection(COLLECTIONS.SALES_DAY_BOOK)
    .doc(uid)
    .collection('sales')
    .orderBy('saleDate', 'desc');

  if (fromDate) query = query.where('saleDate', '>=', fromDate);
  if (toDate)   query = query.where('saleDate', '<=', toDate);

  const snap = await query.get();
  return snap.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id:       doc.id,
      // Convert Firestore Timestamp to ISO string for JSON serialisation
      saleDate: data.saleDate?.toDate?.()?.toISOString() || data.saleDate,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
    };
  });
}

/**
 * recordSale
 * Saves a sale document to Firestore.
 * Stock deduction is handled separately by the inventory controller
 * via PATCH /api/inventory/:id — one authoritative update path.
 *
 * @param {string} uid
 * @param {Object} sale  { inventoryItemId, itemName, unitPrice, salePrice, quantity, totalAmount }
 * @returns {Promise<Object>}  Saved sale with id
 */
async function recordSale(uid, sale) {
  const ref = db
    .collection(COLLECTIONS.SALES_DAY_BOOK)
    .doc(uid)
    .collection('sales')
    .doc();

  const now = new Date();
  const doc = {
    id:          ref.id,

    // ── Multi-item fields ─────────────────────────────────────
    items:          Array.isArray(sale.items) ? sale.items : [],

    // ── Buyer details ─────────────────────────────────────────
    buyerName:      sale.buyerName      || '',
    buyerContact:   sale.buyerContact   || '',   // phone / email / social handle

    // ── Sale metadata ─────────────────────────────────────────
    businessName:   sale.businessName   || '',
    pointOfSale:    sale.pointOfSale    || 'Walk-in',  // channel where sale happened
    paymentStatus:  sale.paymentStatus  || 'Paid',     // 'Paid' | 'Credit'
    paymentMethod:  sale.paymentMethod  || 'Cash',     // 'Cash' | 'Bank Transfer' | 'POS' | etc.
    deliveryDetails: sale.deliveryDetails || '',        // optional delivery info
    recordedBy:     sale.recordedBy     || '',         // name of staff member who recorded the sale
    description:    sale.description    || '',         // optional internal note — never shown on receipt

    // ── Legacy flat fields — backwards compat ────────────────
    inventoryItemId: sale.inventoryItemId || '',
    itemName:        sale.itemName        || '',
    unitPrice:       sale.unitPrice       || 0,
    salePrice:       sale.salePrice       || 0,
    quantity:        sale.quantity        || 0,

    // Grand total across all line items
    totalAmount:    sale.totalAmount,

    saleDate:       FieldValue.serverTimestamp(),
    createdAt:      FieldValue.serverTimestamp(),
    saleDateISO:    now.toISOString(),
  };

  await ref.set(doc);
  return { ...doc, id: ref.id, saleDate: now.toISOString(), createdAt: now.toISOString() };
}

/**
 * updateSale
 *
 * Partially updates a sale document with the provided fields.
 * Only whitelisted fields are written — items, totals, and timestamps
 * that the controller has already validated are accepted as-is.
 *
 * @param {string} uid
 * @param {string} saleId
 * @param {Object} updates  Pre-validated fields from the controller
 * @returns {Promise<void>}
 */
async function updateSale(uid, saleId, updates) {
  const ref = db
    .collection(COLLECTIONS.SALES_DAY_BOOK)
    .doc(uid)
    .collection('sales')
    .doc(saleId);

  await ref.update({
    ...updates,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * deleteSale
 *
 * Sale Return — supports both full and partial returns.
 *
 * FULL RETURN (lineKeys omitted or covers every line):
 *   Deletes the sale document entirely and restores stock for every
 *   inventory-linked line item.
 *
 * PARTIAL RETURN (lineKeys provided, covers a subset of lines):
 *   Removes only the selected lines from the sale's items array,
 *   restores stock only for those lines, recalculates totalAmount,
 *   and updates the sale document (does not delete it) — unless the
 *   selected lines are ALL the lines, in which case it falls back to
 *   a full delete.
 *
 * Custom (non-inventory) line items have no inventoryItemId, so they
 * are simply dropped from the sale with no stock effect.
 *
 * @param {string} uid
 * @param {string} saleId
 * @param {string[]} [lineKeys]  Optional array of line `_key` values to
 *                               return. If omitted, the entire sale is
 *                               returned (legacy / full-return behaviour).
 * @returns {Promise<{ stockUpdates: Array<{id:string,newQuantity:number}>, deleted: boolean, sale: Object|null }>}
 */
async function deleteSale(uid, saleId, lineKeys) {
  const salesRef = db
    .collection(COLLECTIONS.SALES_DAY_BOOK)
    .doc(uid)
    .collection('sales')
    .doc(saleId);

  const saleSnap = await salesRef.get();
  if (!saleSnap.exists) {
    const err = new Error('Sale not found.');
    err.statusCode = 404;
    throw err;
  }

  const sale = saleSnap.data();

  // Normalise the sale into a uniform line-item array, tagging each
  // line with a stable key so callers can reference specific lines.
  // Legacy flat-structure docs are treated as a single synthetic line.
  const allLines = (Array.isArray(sale.items) && sale.items.length > 0)
    ? sale.items.map((l, i) => ({ ...l, _lineKey: l._lineKey || String(i) }))
    : [{
        inventoryItemId: sale.inventoryItemId || '',
        itemName:        sale.itemName        || '',
        unitPrice:       sale.unitPrice        || 0,
        salePrice:       sale.salePrice        || 0,
        quantity:        sale.quantity         || 0,
        totalAmount:     sale.totalAmount      || 0,
        _lineKey: '0',
      }];

  const isPartial = Array.isArray(lineKeys) && lineKeys.length > 0
    && lineKeys.length < allLines.length;

  const linesToReturn = (Array.isArray(lineKeys) && lineKeys.length > 0)
    ? allLines.filter(l => lineKeys.includes(l._lineKey))
    : allLines; // no lineKeys provided → return everything (legacy behaviour)

  if (linesToReturn.length === 0) {
    const err = new Error('No matching line items found to return.');
    err.statusCode = 400;
    throw err;
  }

  // ── Build a map of { inventoryItemId → returnedQuantity } ───────
  const returnMap = {};
  for (const line of linesToReturn) {
    if (!line.inventoryItemId) continue; // custom / non-inventory line — no stock effect
    returnMap[line.inventoryItemId] =
      (returnMap[line.inventoryItemId] || 0) + (line.quantity || 0);
  }

  const itemIds = Object.keys(returnMap);

  // ── Restore stock for returned lines ─────────────────────────────
  const inventoryRef = db.collection('inventory').doc(uid).collection('items');
  const stockUpdates  = [];

  if (itemIds.length > 0) {
    const snapshots = await Promise.all(itemIds.map(id => inventoryRef.doc(id).get()));
    await Promise.all(
      snapshots.map(async snap => {
        if (!snap.exists) return; // item was deleted from inventory — skip
        const currentQty  = snap.data().quantity || 0;
        const returnedQty = returnMap[snap.id]   || 0;
        const newQuantity = currentQty + returnedQty;
        await inventoryRef.doc(snap.id).update({
          quantity:  newQuantity,
          updatedAt: FieldValue.serverTimestamp(),
        });
        stockUpdates.push({ id: snap.id, newQuantity });
      })
    );
  }

  // ── Partial return: update the sale doc with remaining lines ─────
  if (isPartial) {
    const returnedKeys  = new Set(linesToReturn.map(l => l._lineKey));
    const remainingLines = allLines.filter(l => !returnedKeys.has(l._lineKey));
    const newTotal = parseFloat(
      remainingLines.reduce((s, l) => s + (l.totalAmount || 0), 0).toFixed(2)
    );
    const newQuantity = remainingLines.reduce((s, l) => s + (l.quantity || 0), 0);

    await salesRef.update({
      items:        remainingLines,
      totalAmount:  newTotal,
      quantity:     newQuantity,
      itemName:     remainingLines.length === 1 ? remainingLines[0].itemName : `${remainingLines.length} items`,
      updatedAt:    FieldValue.serverTimestamp(),
    });

    // Serialise dates so the frontend never receives raw Firestore Timestamp objects.
    // A Timestamp in the returned `sale` object would crash .slice(0,10) in the
    // filteredSales render and cause a blank/black screen.
    const serialiseSaleDate = (v) => {
      if (!v) return null;
      if (typeof v === 'string') return v;
      if (typeof v.toDate === 'function') return v.toDate().toISOString();
      return String(v);
    };

    const serialisedSale = {
      ...sale,
      id:          saleId,
      items:       remainingLines,
      totalAmount: newTotal,
      quantity:    newQuantity,
      itemName:    remainingLines.length === 1 ? remainingLines[0].itemName : `${remainingLines.length} items`,
      saleDate:    serialiseSaleDate(sale.saleDate),
      saleDateISO: serialiseSaleDate(sale.saleDate),
      createdAt:   serialiseSaleDate(sale.createdAt),
      updatedAt:   new Date().toISOString(),
    };

    return { deleted: false, sale: serialisedSale, stockUpdates };
  }

  // ── Full return: delete the sale document entirely ────────────────
  await salesRef.delete();
  return { deleted: true, sale: null, stockUpdates };
}

/**
 * getItemSaleHistory
 *
 * Returns every sale transaction that contains a specific inventory item,
 * ordered newest first.
 *
 * Strategy: query the user's salesDayBook sub-collection for docs where
 * the `items` array contains an entry with the matching inventoryItemId.
 * Also handles legacy flat-structure docs (inventoryItemId at root level)
 * so older sales records are still surfaced.
 *
 * Each returned entry has the fields the HistoryModal expects:
 *   saleId, quantity, salePrice, lineTotal,
 *   buyerName, buyerContact, pointOfSale, paymentStatus, saleDate
 *
 * @param {string} uid
 * @param {string} itemId
 * @returns {Promise<Object[]>}
 */
async function getItemSaleHistory(uid, itemId) {
  const salesRef = db
    .collection(COLLECTIONS.SALES_DAY_BOOK)
    .doc(uid)
    .collection('sales')
    .orderBy('saleDate', 'desc');

  const snap = await salesRef.get();
  const results = [];

  snap.docs.forEach(doc => {
    const sale = doc.data();
    const saleDate =
      sale.saleDate?.toDate?.()?.toISOString() ||
      sale.saleDateISO ||
      sale.saleDate ||
      null;

    // ── Multi-item sales (current schema) ────────────────────
    if (Array.isArray(sale.items) && sale.items.length > 0) {
      sale.items.forEach(line => {
        if (line.inventoryItemId === itemId) {
          results.push({
            saleId:        doc.id,
            quantity:      line.quantity      || 0,
            salePrice:     line.salePrice     || line.unitPrice || 0,
            lineTotal:     line.lineTotal     || (line.quantity * (line.salePrice || line.unitPrice || 0)),
            buyerName:     sale.buyerName     || '',
            buyerContact:  sale.buyerContact  || '',
            pointOfSale:   sale.pointOfSale   || 'Walk-in',
            paymentStatus: sale.paymentStatus || 'Paid',
            paymentMethod: sale.paymentMethod || 'Cash',
            saleDate,
          });
        }
      });
      return; // skip legacy check for this doc
    }

    // ── Legacy flat-structure docs ────────────────────────────
    if (sale.inventoryItemId === itemId) {
      results.push({
        saleId:        doc.id,
        quantity:      sale.quantity      || 0,
        salePrice:     sale.salePrice     || sale.unitPrice || 0,
        lineTotal:     sale.totalAmount   || (sale.quantity * (sale.salePrice || 0)),
        buyerName:     sale.buyerName     || '',
        buyerContact:  sale.buyerContact  || '',
        pointOfSale:   sale.pointOfSale   || 'Walk-in',
        paymentStatus: sale.paymentStatus || 'Paid',
        paymentMethod: sale.paymentMethod || 'Cash',
        saleDate,
      });
    }
  });

  return results;
}

// ─────────────────────────────────────────────────────────────────
// DAY LOG
// ─────────────────────────────────────────────────────────────────

/**
 * getDayLogEntries
 *
 * Fetches a paginated page of day log entries for a user, ordered
 * newest first. Uses cursor-based pagination via Firestore's
 * startAfter so large logs never cause a delay on load.
 *
 * @param {string}  uid
 * @param {number}  limit        Entries per page (default 10)
 * @param {Object}  [cursor]     Last Firestore document snapshot from previous page
 * @returns {Promise<{ entries: Object[], hasMore: boolean, lastDoc: Object|null }>}
 */
async function getDayLogEntries(uid, limit = 10, cursorId = null) {
  let query = db
    .collection(COLLECTIONS.DAY_LOG)
    .doc(uid)
    .collection('entries')
    .orderBy('entryDate', 'desc');

  // Cursor — get the snapshot of the last document from the previous page
  if (cursorId) {
    const cursorSnap = await db
      .collection(COLLECTIONS.DAY_LOG)
      .doc(uid)
      .collection('entries')
      .doc(cursorId)
      .get();
    if (cursorSnap.exists) query = query.startAfter(cursorSnap);
  }

  // Fetch one extra to know if there's a next page
  const snap    = await query.limit(limit + 1).get();
  const hasMore = snap.docs.length > limit;
  const docs    = hasMore ? snap.docs.slice(0, limit) : snap.docs;

  const entries = docs.map(d => {
    const data = d.data();
    return {
      id:           d.id,
      entryDate:    data.entryDate    || '',
      title:        data.title        || '',
      body:         data.body         || '',
      createdAtISO: data.createdAt?.toDate?.()?.toISOString()
                    || data.createdAtISO
                    || null,
      updatedAtISO: data.updatedAt?.toDate?.()?.toISOString() || null,
    };
  });

  return {
    entries,
    hasMore,
    lastId: docs.length > 0 ? docs[docs.length - 1].id : null,
  };
}

/**
 * getDayLogForAI
 *
 * Fetches the most recent N day log entries for injecting into the
 * AI advisor context. Returns lightweight summary objects only.
 *
 * @param {string} uid
 * @param {number} limit  Max entries to include (default 30)
 * @returns {Promise<Object[]>}
 */
async function getDayLogForAI(uid, limit = 30) {
  const snap = await db
    .collection(COLLECTIONS.DAY_LOG)
    .doc(uid)
    .collection('entries')
    .orderBy('entryDate', 'desc')
    .limit(limit)
    .get();

  return snap.docs.map(d => ({
    id:        d.id,
    entryDate: d.data().entryDate || null,
    title:     d.data().title     || '',
    body:      d.data().body      || '',
  }));
}

/**
 * saveDayLogEntry
 *
 * Creates a new day log entry.
 *
 * @param {string} uid
 * @param {Object} entry  { entryDate, title, body }
 * @returns {Promise<Object>}
 */
async function saveDayLogEntry(uid, entry) {
  const ref = db
    .collection(COLLECTIONS.DAY_LOG)
    .doc(uid)
    .collection('entries')
    .doc();

  const now = new Date();
  const doc = {
    id:          ref.id,
    entryDate:   entry.entryDate,
    title:       entry.title  || '',
    body:        entry.body   || '',
    createdAt:   FieldValue.serverTimestamp(),
    updatedAt:   FieldValue.serverTimestamp(),
    createdAtISO: now.toISOString(),
  };

  await ref.set(doc);

  // Return only serialisable fields — FieldValue.serverTimestamp() objects
  // cannot be sent as JSON. The ISO string is the safe equivalent for the client.
  return {
    id:           ref.id,
    entryDate:    entry.entryDate,
    title:        entry.title  || '',
    body:         entry.body   || '',
    createdAtISO: now.toISOString(),
    updatedAtISO: now.toISOString(),
  };
}

/**
 * updateDayLogEntry
 *
 * Updates title and/or body of an existing entry.
 *
 * @param {string} uid
 * @param {string} entryId
 * @param {Object} updates  { title?, body?, entryDate? }
 * @returns {Promise<void>}
 */
async function updateDayLogEntry(uid, entryId, updates) {
  const ref = db
    .collection(COLLECTIONS.DAY_LOG)
    .doc(uid)
    .collection('entries')
    .doc(entryId);

  await ref.update({
    ...updates,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * deleteDayLogEntry
 *
 * Permanently deletes a day log entry.
 *
 * @param {string} uid
 * @param {string} entryId
 * @returns {Promise<void>}
 */
async function deleteDayLogEntry(uid, entryId) {
  await db
    .collection(COLLECTIONS.DAY_LOG)
    .doc(uid)
    .collection('entries')
    .doc(entryId)
    .delete();
}

module.exports = {
  // Users / GYB
  createGybSession,
  updateGybSession,
  promoteSessionToUser,
  saveCompleteUser,
  deleteGybSession,
  getUserByUid,
  getUserByEmail,
  getUserBySessionId,

  // Nominations
  createNomination,

  // Subscribers
  subscriberExists,
  createSubscriber,

  // Under30
  createUnder30Application,

  // Advisor Sessions
  getAdvisorSession,
  upsertAdvisorSession,

  // Digital CFO Entries
  getCFOEntries,
  getAllCFOEntries,
  saveCFOEntry,
  deleteCFOEntry,

  // Inventory
  getInventoryItems,
  saveInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  uploadInventoryImage,
  deleteInventoryImage,

  // Sales Day Book
  getSales,
  recordSale,
  updateSale,
  deleteSale,
  getItemSaleHistory,

  // Day Log
  getDayLogEntries,
  getDayLogForAI,
  saveDayLogEntry,
  updateDayLogEntry,
  deleteDayLogEntry,
};
