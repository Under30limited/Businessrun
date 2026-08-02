/**
 * services/db.service.js
 *
 * AWS DynamoDB + S3 replacement for firebase.service.js.
 * Every function has an IDENTICAL signature and return shape to its
 * Firebase counterpart — no controller changes required.
 *
 * Database: AWS DynamoDB (Document Client)
 * Storage:  AWS S3 (presigned URLs, same pattern as Firebase Storage)
 *
 * DynamoDB table layout:
 *   br-users           PK: uid (String)  — PURE IDENTITY, nothing business-
 *                      specific. { uid, email, hashedPassword, claimed,
 *                      fullName, sessionId, createdAt, updatedAt }.
 *                      GSI: email-index (PK: email)
 *                      GSI: sessionId-index (PK: sessionId) — used only
 *                           during the GYB onboarding steps 1-3, before an
 *                           identity uid is finalised at step 4.
 *
 *   br-businesses      PK: businessUid (String) — one row per business.
 *                      { businessUid, businessName, stage, salesChannel,
 *                      revenue, headache, matchmaking, createdAt }.
 *                      For businesses that existed before the multi-tenant
 *                      split, businessUid === the original owner's uid, so
 *                      br-inventory/br-salesDayBook/br-dayLog/br-reports/
 *                      br-cfoEntries (all keyed by that same uid) needed
 *                      NO migration. New businesses get a fresh uuid,
 *                      independent of any one identity.
 *
 *   br-memberships     PK: identityUid (String) + SK: businessUid (String)
 *                      — the join table. One identity can have many rows
 *                      (owner of their own business + member of others).
 *                      { identityUid, businessUid, role: 'owner'|'member',
 *                      permissions: string[]|null, status:
 *                      'pending'|'active'|'revoked', invitedAt, invitedBy,
 *                      acceptedAt, inviteToken, inviteExpiresAt }.
 *                      GSI: businessUid-index (PK: businessUid) — lists
 *                           every member of a business (team management).
 *                      Base-table Query (PK: identityUid) lists every
 *                      business a given identity belongs to (login,
 *                      the business switcher).
 *
 *   br-nominations     PK: id  (String)
 *   br-subscribers     PK: email (String) + SK: type (String)
 *   br-under30         PK: id  (String)
 *   br-advisorSessions PK: sessionId (String)
 *   br-cfoEntries      PK: uid (String) + SK: toolName (String)
 *   br-inventory       PK: uid (String) + SK: itemId (String)
 *   br-salesDayBook    PK: uid (String) + SK: saleId  (String)
 *                      GSI: uid-saleDateISO-index (for date range queries)
 *   br-dayLog          PK: uid (String) + SK: entryId (String)
 *                      GSI: uid-entryDate-index (for ordered listing)
 *   br-reports         PK: uid (String) + SK: reportId (String)
 *                      GSI: uid-type-createdAt-index (for type queries)
 *
 * ── NOTE ON "uid" THROUGHOUT THIS FILE ─────────────────────────────
 * Every business-data function below (inventory, sales, dayLog, reports,
 * cfoEntries, advisor sessions) takes a `uid` parameter that means
 * "businessUid" — the tenant whose data this is. That has NOT changed
 * by the multi-tenant split; only WHERE that businessUid comes from
 * changed (see middleware/auth.js: req.user.uid is always businessUid).
 */

'use strict';

const {
  DynamoDBClient,
} = require('@aws-sdk/client-dynamodb');

const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  TransactWriteCommand,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');

const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');

const { v4: uuidv4 }    = require('uuid');
const ApiError          = require('../utils/ApiError');

// ── AWS clients ───────────────────────────────────────────────────
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const ddbClient = new DynamoDBClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const dynamo = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions:   { removeUndefinedValues: true }, // mirrors Firestore ignoreUndefinedProperties
  unmarshallOptions: { wrapNumbers: false },
});

const s3 = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const S3_BUCKET = process.env.AWS_S3_BUCKET;

// ── Table name constants ──────────────────────────────────────────
const TABLES = {
  USERS:          'br-users',
  BUSINESSES:     'br-businesses',
  MEMBERSHIPS:    'br-memberships',
  NOMINATIONS:    'br-nominations',
  SUBSCRIBERS:    'br-subscribers',
  UNDER30:        'br-under30',
  ADVISOR:        'br-advisorSessions',
  CFO_ENTRIES:    'br-cfoEntries',
  INVENTORY:      'br-inventory',
  SALES_DAY_BOOK: 'br-salesDayBook',
  DAY_LOG:        'br-dayLog',
  REPORTS:        'br-reports',
};

// ── Helpers ───────────────────────────────────────────────────────
function nowISO() { return new Date().toISOString(); }
function newId()  { return uuidv4(); }

// Build a DynamoDB UpdateExpression from a plain object of updates.
// Skips undefined values. Returns { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues }
function buildUpdateExpr(updates) {
  const names  = {};
  const values = {};
  const parts  = [];

  for (const [k, v] of Object.entries(updates)) {
    if (v === undefined) continue;
    const nameKey  = `#${k}`;
    const valueKey = `:${k}`;
    names[nameKey]  = k;
    values[valueKey] = v;
    parts.push(`${nameKey} = ${valueKey}`);
  }

  return {
    UpdateExpression:          'SET ' + parts.join(', '),
    ExpressionAttributeNames:  names,
    ExpressionAttributeValues: values,
  };
}

// ─────────────────────────────────────────────────────────────────
// USERS / GYB ONBOARDING
// ─────────────────────────────────────────────────────────────────

async function createGybSession(sessionId, data) {
  // Check if session already exists (duplicate submission)
  const existing = await dynamo.send(new GetCommand({
    TableName: TABLES.USERS,
    Key:       { uid: sessionId },
  }));

  const now = nowISO();

  if (existing.Item) {
    // Idempotent update
    const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } =
      buildUpdateExpr({
        fullName:     data.fullName,
        businessName: data.businessName,
        email:        data.email,
        updatedAt:    now,
      });
    await dynamo.send(new UpdateCommand({
      TableName: TABLES.USERS,
      Key:       { uid: sessionId },
      UpdateExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
    }));
    return;
  }

  await dynamo.send(new PutCommand({
    TableName: TABLES.USERS,
    Item: {
      uid:            sessionId,  // temporary — gets overwritten at step 4
      sessionId,
      fullName:       data.fullName,
      businessName:   data.businessName,
      email:          data.email,
      onboardingStep: 1,
      completed:      false,
      profileSaved:   false,
      source:         data.source || 'businessrun-gyb',
      createdAt:      now,
      updatedAt:      now,
    },
  }));
}

async function updateGybSession(sessionId, data) {
  const existing = await dynamo.send(new GetCommand({
    TableName: TABLES.USERS,
    Key:       { uid: sessionId },
  }));

  const now = nowISO();

  if (!existing.Item) {
    console.warn(`[DB] updateGybSession: session ${sessionId} not found — creating recovery doc`);
    await dynamo.send(new PutCommand({
      TableName: TABLES.USERS,
      Item: {
        uid:            sessionId,
        sessionId,
        ...data,
        onboardingStep: data.onboardingStep || 2,
        completed:      false,
        profileSaved:   false,
        createdAt:      now,
        updatedAt:      now,
      },
    }));
    return;
  }

  const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } =
    buildUpdateExpr({ ...data, updatedAt: now });

  await dynamo.send(new UpdateCommand({
    TableName: TABLES.USERS,
    Key:       { uid: sessionId },
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
  }));
}

async function promoteSessionToUser(sessionId, uid, extraData = {}) {
  // Fetch session doc
  const sessionResult = await dynamo.send(new GetCommand({
    TableName: TABLES.USERS,
    Key:       { uid: sessionId },
  }));

  if (!sessionResult.Item) {
    throw ApiError.notFound(`GYB session ${sessionId} not found during promotion.`);
  }

  const sessionData = sessionResult.Item;
  const now         = nowISO();

  // DynamoDB TransactWrite — atomic: create user + delete session
  await dynamo.send(new TransactWriteCommand({
    TransactItems: [
      {
        Put: {
          TableName: TABLES.USERS,
          Item: {
            ...sessionData,
            uid,
            sessionId,
            onboardingStep: 4,
            completed:      true,
            profileSaved:   true,
            profileSavedAt: extraData.profileSavedAt || now,
            updatedAt:      now,
          },
        },
      },
      {
        Delete: {
          TableName: TABLES.USERS,
          Key:       { uid: sessionId },
        },
      },
    ],
  }));
}

async function getUserByUid(uid) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLES.USERS,
    Key:       { uid },
  }));
  return result.Item || null;
}

async function getUserByEmail(email) {
  const normalised = email.toLowerCase().trim();

  // Query the email-index GSI, preferring a CLAIMED identity (one with a
  // password already set) over an unclaimed stub (a pending invite, or a
  // GYB session doc mid-onboarding — both also carry an email field and
  // would otherwise show up here too).
  const result = await dynamo.send(new QueryCommand({
    TableName:                 TABLES.USERS,
    IndexName:                 'email-index',
    KeyConditionExpression:    '#email = :email',
    FilterExpression:          '#claimed = :true',
    ExpressionAttributeNames:  { '#email': 'email', '#claimed': 'claimed' },
    ExpressionAttributeValues: { ':email': normalised, ':true': true },
    Limit: 1,
  }));

  if (result.Items && result.Items.length > 0) return result.Items[0];

  // Fallback without the claimed filter — returns an unclaimed identity
  // stub if one exists (e.g. someone invited but never accepted yet).
  const fallback = await dynamo.send(new QueryCommand({
    TableName:                 TABLES.USERS,
    IndexName:                 'email-index',
    KeyConditionExpression:    '#email = :email',
    ExpressionAttributeNames:  { '#email': 'email' },
    ExpressionAttributeValues: { ':email': normalised },
    Limit: 1,
  }));

  return fallback.Items && fallback.Items.length > 0 ? fallback.Items[0] : null;
}

async function getUserBySessionId(sessionId) {
  // Try direct lookup first (session doc keyed by sessionId)
  const direct = await dynamo.send(new GetCommand({
    TableName: TABLES.USERS,
    Key:       { uid: sessionId },
  }));
  if (direct.Item) return direct.Item;

  // Fallback: query sessionId-index GSI
  const result = await dynamo.send(new QueryCommand({
    TableName:                 TABLES.USERS,
    IndexName:                 'sessionId-index',
    KeyConditionExpression:    '#sid = :sid',
    ExpressionAttributeNames:  { '#sid': 'sessionId' },
    ExpressionAttributeValues: { ':sid': sessionId },
    Limit: 1,
  }));

  return result.Items && result.Items.length > 0 ? result.Items[0] : null;
}

async function updateUserPassword(uid, hashedPassword) {
  const now = nowISO();
  const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } =
    buildUpdateExpr({ hashedPassword, claimed: true, updatedAt: now });

  await dynamo.send(new UpdateCommand({
    TableName: TABLES.USERS,
    Key:       { uid },
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
  }));
}

/**
 * createIdentity
 * Creates a brand-new identity row — pure login credentials, no
 * business data.
 *
 * Two cases:
 *   - GYB signup (new email, sets a password immediately): claimed: true
 *   - Team invite to a brand-new email (no password yet — set later at
 *     accept-invite): pass hashedPassword: null and claimed: false
 *
 * @param {string} uid
 * @param {Object} data  { email, hashedPassword, claimed, fullName, sessionId, source }
 */
async function createIdentity(uid, data) {
  const now = nowISO();
  await dynamo.send(new PutCommand({
    TableName: TABLES.USERS,
    Item: {
      uid,
      email:          data.email          || '',
      hashedPassword: data.hashedPassword || null,
      claimed:        data.claimed ?? true,
      fullName:       data.fullName       || '',
      // sessionId is a GSI partition key (sessionId-index) — DynamoDB
      // rejects an empty string as a key value, so it's OMITTED
      // entirely rather than defaulted to '' when there's no real
      // session id (e.g. a team invite to a brand-new email, which
      // never went through the GYB onboarding steps at all).
      ...(data.sessionId ? { sessionId: data.sessionId } : {}),
      source:         data.source         || 'businessrun-gyb',
      createdAt:      now,
      updatedAt:      now,
    },
  }));
  console.log(`[DB] Identity created: ${uid} (${data.email}) claimed=${data.claimed ?? true}`);
}

async function deleteGybSession(sessionId) {
  await dynamo.send(new DeleteCommand({
    TableName: TABLES.USERS,
    Key:       { uid: sessionId },
  }));
  console.log(`[DB] Session doc deleted: ${sessionId}`);
}

// ─────────────────────────────────────────────────────────────────
// BUSINESSES
//
// One row per business. businessUid is a fresh uuid for every new
// business — for businesses that existed before the multi-tenant
// split, businessUid equals the original owner's uid instead, which
// is what lets br-inventory/br-salesDayBook/br-dayLog/br-reports/
// br-cfoEntries (all keyed by that uid already) work unmigrated.
// ─────────────────────────────────────────────────────────────────

async function createBusiness(businessUid, data) {
  const now = nowISO();
  await dynamo.send(new PutCommand({
    TableName: TABLES.BUSINESSES,
    Item: {
      businessUid,
      businessName: data.businessName || '',
      stage:        data.stage        || '',
      salesChannel: data.salesChannel || '',
      revenue:      data.revenue      || '',
      headache:     data.headache     || '',
      matchmaking:  data.matchmaking  || '',
      createdAt:    now,
      updatedAt:    now,
    },
  }));
  console.log(`[DB] Business created: ${businessUid} (${data.businessName})`);
}

async function getBusiness(businessUid) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLES.BUSINESSES,
    Key:       { businessUid },
  }));
  return result.Item || null;
}

// ─────────────────────────────────────────────────────────────────
// MEMBERSHIPS
//
// The join table between identities and businesses. PK: identityUid,
// SK: businessUid — one row per (person, business) pair.
//
// STATUS LIFECYCLE:
//   'pending' — invited, membership not yet activated
//   'active'  — can access this business (subject to `permissions`
//               for role:'member'; role:'owner' always has full access)
//   'revoked' — access pulled; login and requireFeature both block this
// ─────────────────────────────────────────────────────────────────

/**
 * createMembership
 * Creates a membership row linking an identity to a business.
 * Used both for a brand-new owner's first business (status: 'active'
 * immediately, no invite involved) and for inviting a team member
 * (status: 'pending' until they accept).
 *
 * @param {Object} data  { identityUid, businessUid, role, permissions,
 *                          status, email, invitedBy, inviteToken,
 *                          inviteExpiresAt }
 */
async function createMembership(data) {
  const now = nowISO();
  const item = {
    identityUid:     data.identityUid,
    businessUid:     data.businessUid,
    role:            data.role,                    // 'owner' | 'member'
    permissions:     data.permissions ?? null,      // null = unrestricted (owner)
    status:          data.status || 'pending',
    email:           data.email || '',              // denormalised, for team-list display
    invitedAt:       now,
    invitedBy:       data.invitedBy || null,
    acceptedAt:      data.status === 'active' ? now : null,
    inviteToken:     data.inviteToken     || null,
    inviteExpiresAt: data.inviteExpiresAt || null,
    createdAt:       now,
    updatedAt:       now,
  };
  await dynamo.send(new PutCommand({ TableName: TABLES.MEMBERSHIPS, Item: item }));
  console.log(`[DB] Membership created: identity ${data.identityUid} → business ${data.businessUid} (${data.role})`);
  return item;
}

/**
 * getMembership
 * Fetches one specific (identityUid, businessUid) membership.
 * Used everywhere permission checks happen, and for invite acceptance.
 */
async function getMembership(identityUid, businessUid) {
  if (!identityUid || !businessUid) {
    console.warn('[DB] getMembership called with missing identityUid/businessUid — likely a stale pre-migration session cookie.');
    return null;
  }
  const result = await dynamo.send(new GetCommand({
    TableName: TABLES.MEMBERSHIPS,
    Key:       { identityUid, businessUid },
  }));
  return result.Item || null;
}

/**
 * getMembershipsForIdentity
 * Every business a given identity belongs to (owner or member,
 * any status). Used at login to decide: sign straight in (one active
 * membership), offer a business picker (more than one), or reject
 * (zero active memberships).
 */
async function getMembershipsForIdentity(identityUid) {
  if (!identityUid) {
    // Can legitimately happen for a session cookie signed before this
    // feature was deployed (up to 7 days old) — no identityUid in an
    // old payload. Fail soft rather than sending DynamoDB a query with
    // an empty ExpressionAttributeValues, which it rejects outright.
    console.warn('[DB] getMembershipsForIdentity called with no identityUid — likely a stale pre-migration session cookie.');
    return [];
  }
  const result = await dynamo.send(new QueryCommand({
    TableName:                 TABLES.MEMBERSHIPS,
    KeyConditionExpression:    '#identityUid = :identityUid',
    ExpressionAttributeNames:  { '#identityUid': 'identityUid' },
    ExpressionAttributeValues: { ':identityUid': identityUid },
  }));
  return result.Items || [];
}

/**
 * getMembershipsForBusiness
 * Every member of a business (for the owner's Team panel).
 * Requires the businessUid-index GSI.
 */
async function getMembershipsForBusiness(businessUid) {
  const result = await dynamo.send(new QueryCommand({
    TableName:                 TABLES.MEMBERSHIPS,
    IndexName:                 'businessUid-index',
    KeyConditionExpression:    '#businessUid = :businessUid',
    ExpressionAttributeNames:  { '#businessUid': 'businessUid' },
    ExpressionAttributeValues: { ':businessUid': businessUid },
  }));
  return result.Items || [];
}

/**
 * updateMembership
 * Patches arbitrary fields on a membership — permissions, status, etc.
 */
async function updateMembership(identityUid, businessUid, updates) {
  const names  = { '#updatedAt': 'updatedAt' };
  const values = { ':updatedAt': nowISO() };
  const sets   = ['#updatedAt = :updatedAt'];

  for (const [key, value] of Object.entries(updates)) {
    names[`#${key}`]  = key;
    values[`:${key}`] = value;
    sets.push(`#${key} = :${key}`);
  }

  await dynamo.send(new UpdateCommand({
    TableName:                 TABLES.MEMBERSHIPS,
    Key:                       { identityUid, businessUid },
    UpdateExpression:          'SET ' + sets.join(', '),
    ExpressionAttributeNames:  names,
    ExpressionAttributeValues: values,
  }));
}

async function deleteMembership(identityUid, businessUid) {
  await dynamo.send(new DeleteCommand({
    TableName: TABLES.MEMBERSHIPS,
    Key:       { identityUid, businessUid },
  }));
  console.log(`[DB] Membership deleted: identity ${identityUid} → business ${businessUid}`);
}

/**
 * acceptMembership
 * Activates a pending membership after the invite token checks out.
 * Does NOT touch the identity's password — that's a separate step
 * (createIdentity or updateUserPassword), only needed if the identity
 * was unclaimed when invited.
 */
async function acceptMembership(identityUid, businessUid) {
  await dynamo.send(new UpdateCommand({
    TableName:                 TABLES.MEMBERSHIPS,
    Key:                       { identityUid, businessUid },
    UpdateExpression:          'SET #status = :active, acceptedAt = :now, inviteToken = :null, updatedAt = :now',
    ExpressionAttributeNames:  { '#status': 'status' },
    ExpressionAttributeValues: { ':active': 'active', ':now': nowISO(), ':null': null },
  }));
}

// ─────────────────────────────────────────────────────────────────
// NOMINATIONS

// ─────────────────────────────────────────────────────────────────

async function createNomination(data) {
  const id  = newId();
  const now = nowISO();
  await dynamo.send(new PutCommand({
    TableName: TABLES.NOMINATIONS,
    Item: { id, ...data, status: 'Pending', submittedAt: now },
  }));
  return { id };
}

// ─────────────────────────────────────────────────────────────────
// SUBSCRIBERS
// ─────────────────────────────────────────────────────────────────

async function subscriberExists(email, type) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLES.SUBSCRIBERS,
    Key:       { email: email.toLowerCase().trim(), type },
  }));
  return !!result.Item;
}

async function createSubscriber(data) {
  const id  = newId();
  const now = nowISO();
  await dynamo.send(new PutCommand({
    TableName: TABLES.SUBSCRIBERS,
    Item: {
      id,
      email:        data.email.toLowerCase().trim(),
      type:         data.type,
      resource:     data.resource || null,
      source:       data.source   || 'businessrun-website',
      subscribedAt: now,
    },
  }));
  return { id };
}

// ─────────────────────────────────────────────────────────────────
// UNDER30 APPLICATIONS
// ─────────────────────────────────────────────────────────────────

async function createUnder30Application(data) {
  const id  = newId();
  const now = nowISO();
  await dynamo.send(new PutCommand({
    TableName: TABLES.UNDER30,
    Item: { id, ...data, status: 'Pending', submittedAt: now },
  }));
  return { id };
}

// ─────────────────────────────────────────────────────────────────
// ADVISOR SESSIONS
// ─────────────────────────────────────────────────────────────────

async function getAdvisorSession(sessionId) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLES.ADVISOR,
    Key:       { sessionId },
  }));
  return result.Item || null;
}

async function upsertAdvisorSession(sessionId, userId, messages) {
  const now     = nowISO();
  const existing = await dynamo.send(new GetCommand({
    TableName: TABLES.ADVISOR,
    Key:       { sessionId },
  }));

  if (existing.Item) {
    const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } =
      buildUpdateExpr({ userId, messages, updatedAt: now });
    await dynamo.send(new UpdateCommand({
      TableName: TABLES.ADVISOR,
      Key:       { sessionId },
      UpdateExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
    }));
  } else {
    await dynamo.send(new PutCommand({
      TableName: TABLES.ADVISOR,
      Item: { sessionId, userId, messages, createdAt: now, updatedAt: now },
    }));
  }
}

// ─────────────────────────────────────────────────────────────────
// DIGITAL CFO ENTRIES
// ─────────────────────────────────────────────────────────────────
// DynamoDB layout: br-cfoEntries PK=uid SK=toolName
// entries[] stored as a DynamoDB List attribute — same shape as Firestore array

async function getCFOEntries(uid, toolName) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLES.CFO_ENTRIES,
    Key:       { uid, toolName },
  }));
  return result.Item?.entries || [];
}

async function getAllCFOEntries(uid) {
  const TOOLS = ['General Ledger', 'Income Statement', 'Balance Sheet', 'Cash Flow'];
  const results = await Promise.all(TOOLS.map(tool => getCFOEntries(uid, tool)));
  return Object.fromEntries(TOOLS.map((tool, i) => [tool, results[i]]));
}

async function saveCFOEntry(uid, toolName, entry) {
  const now          = nowISO();
  const entryWithMeta = {
    ...entry,
    id:      `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    savedAt: now,
  };

  // Fetch existing, append, put back — DynamoDB has no arrayUnion equivalent in lib-dynamodb
  const existing = await getCFOEntries(uid, toolName);
  const updated  = [...existing, entryWithMeta];

  await dynamo.send(new PutCommand({
    TableName: TABLES.CFO_ENTRIES,
    Item: { uid, toolName, entries: updated, updatedAt: now },
  }));

  return entryWithMeta;
}

async function deleteCFOEntry(uid, toolName, entryId) {
  const existing = await getCFOEntries(uid, toolName);
  const updated  = existing.filter(e => e.id !== entryId);
  const now      = nowISO();

  await dynamo.send(new PutCommand({
    TableName: TABLES.CFO_ENTRIES,
    Item: { uid, toolName, entries: updated, updatedAt: now },
  }));
}

// ─────────────────────────────────────────────────────────────────
// INVENTORY
// ─────────────────────────────────────────────────────────────────
// DynamoDB layout: br-inventory PK=uid SK=itemId
// GSI: createdAt-index for ordering

async function getInventoryItems(uid) {
  const result = await dynamo.send(new QueryCommand({
    TableName:                 TABLES.INVENTORY,
    KeyConditionExpression:    '#uid = :uid',
    ExpressionAttributeNames:  { '#uid': 'uid' },
    ExpressionAttributeValues: { ':uid': uid },
  }));

  const items = result.Items || [];
  // Sort by createdAt desc in memory — avoids needing a GSI just for ordering
  return items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

async function saveInventoryItem(uid, item) {
  const itemId = item.id || newId();
  const now    = nowISO();

  const doc = {
    uid,
    itemId,
    id:            itemId,
    name:          item.name,
    category:      item.category      || '',
    unit_price:    item.unit_price,
    cost_price:    item.cost_price     || 0,
    quantity:      item.quantity,
    serial_number: item.serial_number  || '',
    image_url:     item.image_url      || null,
    image_ext:     item.image_ext      || null,
    createdAtISO:  now,
    createdAt:     now,
    updatedAt:     now,
  };

  await dynamo.send(new PutCommand({ TableName: TABLES.INVENTORY, Item: doc }));
  return doc;
}

async function updateInventoryItem(uid, itemId, updates) {
  const now = nowISO();
  const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } =
    buildUpdateExpr({ ...updates, updatedAt: now });

  await dynamo.send(new UpdateCommand({
    TableName:                 TABLES.INVENTORY,
    Key:                       { uid, itemId },
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
  }));
}

async function deleteInventoryItem(uid, itemId) {
  await dynamo.send(new DeleteCommand({
    TableName: TABLES.INVENTORY,
    Key:       { uid, itemId },
  }));
}

async function uploadInventoryImage(uid, itemId, fileBuffer, originalname, mimetype) {
  const ext  = originalname.split('.').pop().toLowerCase();
  const key  = `inventory/${uid}/${itemId}/product.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket:       S3_BUCKET,
    Key:          key,
    Body:         fileBuffer,
    ContentType:  mimetype,
    CacheControl: 'public, max-age=31536000',
  }));

  // Plain public URL — NOT presigned. S3 presigned (SigV4) URLs are
  // hard-capped at 7 days by AWS no matter what expiresIn is set to,
  // which made these product images go dead a week after upload.
  // These images aren't sensitive, so a permanent public URL is the
  // right fit — requires the bucket path to actually be public-read
  // (see the bucket policy in the deployment notes; this alone does
  // nothing without that policy in place).
  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
}

async function deleteInventoryImage(uid, itemId, originalExt) {
  try {
    const key = `inventory/${uid}/${itemId}/product.${originalExt || 'jpg'}`;
    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  } catch (err) {
    console.warn('[Inventory] S3 delete failed (non-fatal):', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// SALES DAY BOOK
// ─────────────────────────────────────────────────────────────────
// DynamoDB layout: br-salesDayBook PK=uid SK=saleId
// GSI: uid-saleDateISO-index (PK=uid, SK=saleDateISO) for date range queries

async function getSales(uid, fromDate, toDate) {
  let params;

  if (fromDate || toDate) {
    // Use GSI for date-range queries
    params = {
      TableName:                 TABLES.SALES_DAY_BOOK,
      IndexName:                 'uid-saleDateISO-index',
      KeyConditionExpression:    '#uid = :uid' +
        (fromDate && toDate ? ' AND #saleDateISO BETWEEN :from AND :to'
        : fromDate          ? ' AND #saleDateISO >= :from'
                            : ' AND #saleDateISO <= :to'),
      ExpressionAttributeNames:  { '#uid': 'uid', '#saleDateISO': 'saleDateISO' },
      ExpressionAttributeValues: {
        ':uid':  uid,
        ...(fromDate ? { ':from': fromDate }                      : {}),
        ...(toDate   ? { ':to':   toDate + 'T23:59:59.999Z' }    : {}),
      },
      ScanIndexForward: false, // newest first
    };
  } else {
    // No date filter — fetch all sales for user
    params = {
      TableName:                 TABLES.SALES_DAY_BOOK,
      KeyConditionExpression:    '#uid = :uid',
      ExpressionAttributeNames:  { '#uid': 'uid' },
      ExpressionAttributeValues: { ':uid': uid },
      ScanIndexForward: false,
    };
  }

  const result = await dynamo.send(new QueryCommand(params));
  return (result.Items || []).map(item => ({
    ...item,
    id:          item.saleId,
    saleDate:    item.saleDateISO || null,
    saleDateISO: item.saleDateISO || null,
  }));
}

async function recordSale(uid, sale) {
  const saleId = newId();
  const now    = nowISO();

  const doc = {
    uid,
    saleId,
    id:              saleId,
    items:           Array.isArray(sale.items) ? sale.items : [],
    buyerName:       sale.buyerName       || '',
    buyerContact:    sale.buyerContact    || '',
    businessName:    sale.businessName    || '',
    pointOfSale:     sale.pointOfSale     || 'Walk-in',
    paymentStatus:   sale.paymentStatus   || 'Paid',
    paymentMethod:   sale.paymentMethod   || 'Cash',
    deliveryDetails: sale.deliveryDetails || '',
    recordedBy:      sale.recordedBy      || '',
    description:     sale.description     || '',
    inventoryItemId: sale.inventoryItemId || '',
    itemName:        sale.itemName        || '',
    unitPrice:       sale.unitPrice       || 0,
    salePrice:       sale.salePrice       || 0,
    quantity:        sale.quantity        || 0,
    totalAmount:     sale.totalAmount,
    saleDate:        now,
    saleDateISO:     now,
    createdAt:       now,
  };

  await dynamo.send(new PutCommand({ TableName: TABLES.SALES_DAY_BOOK, Item: doc }));
  return doc;
}

async function updateSale(uid, saleId, updates) {
  const now = nowISO();
  const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } =
    buildUpdateExpr({ ...updates, updatedAt: now });

  await dynamo.send(new UpdateCommand({
    TableName:                 TABLES.SALES_DAY_BOOK,
    Key:                       { uid, saleId },
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
  }));
}

async function deleteSale(uid, saleId, lineKeys) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLES.SALES_DAY_BOOK,
    Key:       { uid, saleId },
  }));

  if (!result.Item) {
    const err = new Error('Sale not found.');
    err.statusCode = 404;
    throw err;
  }

  const sale     = result.Item;
  const allLines = (Array.isArray(sale.items) && sale.items.length > 0)
    ? sale.items.map((l, i) => ({ ...l, _lineKey: l._lineKey || String(i) }))
    : [{
        inventoryItemId: sale.inventoryItemId || '',
        itemName:        sale.itemName        || '',
        unitPrice:       sale.unitPrice       || 0,
        salePrice:       sale.salePrice       || 0,
        quantity:        sale.quantity        || 0,
        totalAmount:     sale.totalAmount     || 0,
        _lineKey: '0',
      }];

  const isPartial     = Array.isArray(lineKeys) && lineKeys.length > 0 && lineKeys.length < allLines.length;
  const linesToReturn = (Array.isArray(lineKeys) && lineKeys.length > 0)
    ? allLines.filter(l => lineKeys.includes(l._lineKey))
    : allLines;

  if (linesToReturn.length === 0) {
    const err = new Error('No matching line items found to return.');
    err.statusCode = 400;
    throw err;
  }

  // Build stock return map
  const returnMap = {};
  for (const line of linesToReturn) {
    if (!line.inventoryItemId) continue;
    returnMap[line.inventoryItemId] = (returnMap[line.inventoryItemId] || 0) + (line.quantity || 0);
  }

  // Restore stock
  const stockUpdates = [];
  await Promise.all(
    Object.entries(returnMap).map(async ([itemId, returnedQty]) => {
      const inv = await dynamo.send(new GetCommand({
        TableName: TABLES.INVENTORY,
        Key:       { uid, itemId },
      }));
      if (!inv.Item) return;
      const newQuantity = (inv.Item.quantity || 0) + returnedQty;
      await updateInventoryItem(uid, itemId, { quantity: newQuantity });
      stockUpdates.push({ id: itemId, newQuantity });
    })
  );

  if (isPartial) {
    const returnedKeys   = new Set(linesToReturn.map(l => l._lineKey));
    const remainingLines = allLines.filter(l => !returnedKeys.has(l._lineKey));
    const newTotal       = parseFloat(remainingLines.reduce((s, l) => s + (l.totalAmount || 0), 0).toFixed(2));
    const newQuantity    = remainingLines.reduce((s, l) => s + (l.quantity || 0), 0);
    const now            = nowISO();

    await updateSale(uid, saleId, {
      items:       remainingLines,
      totalAmount: newTotal,
      quantity:    newQuantity,
      itemName:    remainingLines.length === 1 ? remainingLines[0].itemName : `${remainingLines.length} items`,
    });

    return {
      deleted: false,
      sale:    { ...sale, id: saleId, items: remainingLines, totalAmount: newTotal, quantity: newQuantity, saleDate: sale.saleDateISO, updatedAt: now },
      stockUpdates,
    };
  }

  await dynamo.send(new DeleteCommand({
    TableName: TABLES.SALES_DAY_BOOK,
    Key:       { uid, saleId },
  }));

  return { deleted: true, sale: null, stockUpdates };
}

async function getItemSaleHistory(uid, itemId) {
  const result = await dynamo.send(new QueryCommand({
    TableName:                 TABLES.SALES_DAY_BOOK,
    KeyConditionExpression:    '#uid = :uid',
    ExpressionAttributeNames:  { '#uid': 'uid' },
    ExpressionAttributeValues: { ':uid': uid },
    ScanIndexForward: false,
  }));

  const results = [];
  (result.Items || []).forEach(sale => {
    if (Array.isArray(sale.items) && sale.items.length > 0) {
      sale.items.forEach(line => {
        if (line.inventoryItemId === itemId) {
          results.push({
            saleId:        sale.saleId,
            quantity:      line.quantity      || 0,
            salePrice:     line.salePrice     || line.unitPrice || 0,
            lineTotal:     line.totalAmount   || (line.quantity * (line.salePrice || 0)),
            buyerName:     sale.buyerName     || '',
            buyerContact:  sale.buyerContact  || '',
            pointOfSale:   sale.pointOfSale   || 'Walk-in',
            paymentStatus: sale.paymentStatus || 'Paid',
            paymentMethod: sale.paymentMethod || 'Cash',
            saleDate:      sale.saleDateISO   || null,
          });
        }
      });
    } else if (sale.inventoryItemId === itemId) {
      results.push({
        saleId:        sale.saleId,
        quantity:      sale.quantity      || 0,
        salePrice:     sale.salePrice     || 0,
        lineTotal:     sale.totalAmount   || 0,
        buyerName:     sale.buyerName     || '',
        buyerContact:  sale.buyerContact  || '',
        pointOfSale:   sale.pointOfSale   || 'Walk-in',
        paymentStatus: sale.paymentStatus || 'Paid',
        paymentMethod: sale.paymentMethod || 'Cash',
        saleDate:      sale.saleDateISO   || null,
      });
    }
  });

  return results;
}

// ─────────────────────────────────────────────────────────────────
// DAY LOG
// ─────────────────────────────────────────────────────────────────
// DynamoDB layout: br-dayLog PK=uid SK=entryId
// GSI: uid-entryDate-index (PK=uid, SK=entryDate) for ordered listing

async function getDayLogEntries(uid, limit = 10, cursorId = null) {
  const params = {
    TableName:                 TABLES.DAY_LOG,
    IndexName:                 'uid-entryDate-index',
    KeyConditionExpression:    '#uid = :uid',
    ExpressionAttributeNames:  { '#uid': 'uid' },
    ExpressionAttributeValues: { ':uid': uid },
    ScanIndexForward:          false,
    Limit:                     limit + 1,
  };

  // Cursor: use ExclusiveStartKey for DynamoDB pagination
  if (cursorId) {
    // Fetch the cursor item to get its sort key value
    const cursorItem = await dynamo.send(new GetCommand({
      TableName: TABLES.DAY_LOG,
      Key:       { uid, entryId: cursorId },
    }));
    if (cursorItem.Item) {
      params.ExclusiveStartKey = {
        uid,
        entryId:   cursorItem.Item.entryId,
        entryDate: cursorItem.Item.entryDate,
      };
    }
  }

  const result  = await dynamo.send(new QueryCommand(params));
  const items   = result.Items || [];
  const hasMore = items.length > limit;
  const docs    = hasMore ? items.slice(0, limit) : items;

  const entries = docs.map(d => ({
    id:           d.entryId,
    entryDate:    d.entryDate    || '',
    title:        d.title        || '',
    body:         d.body         || '',
    createdAtISO: d.createdAt    || null,
    updatedAtISO: d.updatedAt    || null,
  }));

  return { entries, hasMore, lastId: docs.length > 0 ? docs[docs.length - 1].entryId : null };
}

async function getDayLogForAI(uid, limit = 30) {
  const result = await dynamo.send(new QueryCommand({
    TableName:                 TABLES.DAY_LOG,
    IndexName:                 'uid-entryDate-index',
    KeyConditionExpression:    '#uid = :uid',
    ExpressionAttributeNames:  { '#uid': 'uid' },
    ExpressionAttributeValues: { ':uid': uid },
    ScanIndexForward:          false,
    Limit:                     limit,
  }));

  return (result.Items || []).map(d => ({
    id:        d.entryId,
    entryDate: d.entryDate || '',
    title:     d.title     || '',
    body:      d.body      || '',
  }));
}

async function saveDayLogEntry(uid, entry) {
  const entryId = newId();
  const now     = nowISO();

  const doc = {
    uid,
    entryId,
    entryDate: entry.entryDate,
    title:     entry.title || '',
    body:      entry.body  || '',
    createdAt: now,
    updatedAt: now,
  };

  await dynamo.send(new PutCommand({ TableName: TABLES.DAY_LOG, Item: doc }));

  return {
    id:           entryId,
    entryDate:    entry.entryDate,
    title:        entry.title || '',
    body:         entry.body  || '',
    createdAtISO: now,
    updatedAtISO: now,
  };
}

async function updateDayLogEntry(uid, entryId, updates) {
  const now = nowISO();
  const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } =
    buildUpdateExpr({ ...updates, updatedAt: now });

  await dynamo.send(new UpdateCommand({
    TableName:                 TABLES.DAY_LOG,
    Key:                       { uid, entryId },
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
  }));
}

async function deleteDayLogEntry(uid, entryId) {
  await dynamo.send(new DeleteCommand({
    TableName: TABLES.DAY_LOG,
    Key:       { uid, entryId },
  }));
}

// ─────────────────────────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────────────────────────
// DynamoDB layout: br-reports PK=uid SK=reportId
// GSI: uid-type-index (PK=uid, SK=type#createdAt) for type-filtered ordered queries

async function getReports(uid, type) {
  // Query all reports for user then filter by type in memory
  // (avoids needing a composite GSI sort key for the simple use case)
  const result = await dynamo.send(new QueryCommand({
    TableName:                 TABLES.REPORTS,
    KeyConditionExpression:    '#uid = :uid',
    FilterExpression:          '#type = :type',
    ExpressionAttributeNames:  { '#uid': 'uid', '#type': 'type' },
    ExpressionAttributeValues: { ':uid': uid, ':type': type },
    ScanIndexForward:          false,
  }));

  return (result.Items || [])
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .map(d => ({
      id:           d.reportId,
      type:         d.type,
      title:        d.title       || '',
      content:      d.content     || '',
      fromDate:     d.fromDate    || null,
      toDate:       d.toDate      || null,
      createdAtISO: d.createdAt   || null,
    }));
}

async function countReportsToday(uid) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const result = await dynamo.send(new QueryCommand({
    TableName:                 TABLES.REPORTS,
    KeyConditionExpression:    '#uid = :uid',
    FilterExpression:          '#createdAt >= :since',
    ExpressionAttributeNames:  { '#uid': 'uid', '#createdAt': 'createdAt' },
    ExpressionAttributeValues: { ':uid': uid, ':since': since },
    Select:                    'COUNT',
  }));
  return result.Count || 0;
}

async function saveReport(uid, report) {
  const reportId = newId();
  const now      = nowISO();

  const doc = {
    uid,
    reportId,
    type:      report.type,
    title:     report.title    || '',
    content:   report.content  || '',
    fromDate:  report.fromDate || null,
    toDate:    report.toDate   || null,
    createdAt: now,
  };

  await dynamo.send(new PutCommand({ TableName: TABLES.REPORTS, Item: doc }));
  return { id: reportId, ...doc };
}

async function deleteReport(uid, reportId) {
  await dynamo.send(new DeleteCommand({
    TableName: TABLES.REPORTS,
    Key:       { uid, reportId },
  }));
}

// ─────────────────────────────────────────────────────────────────
// MODULE EXPORTS — identical names to firebase.service.js
// ─────────────────────────────────────────────────────────────────

module.exports = {
  // Users / GYB — pure identity now
  createGybSession,
  updateGybSession,
  promoteSessionToUser,
  createIdentity,
  updateUserPassword,
  deleteGybSession,
  getUserByUid,
  getUserByEmail,
  getUserBySessionId,

  // Businesses
  createBusiness,
  getBusiness,

  // Memberships (identity ↔ business join table)
  createMembership,
  getMembership,
  getMembershipsForIdentity,
  getMembershipsForBusiness,
  updateMembership,
  deleteMembership,
  acceptMembership,

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

  // Reports
  getReports,
  countReportsToday,
  saveReport,
  deleteReport,
};
