/**
 * services/personal.service.js
 *
 * All data access for Personal Wealth OS — deliberately INDEPENDENT
 * from services/db.service.js (its own AWS clients, its own table
 * constants), per the build decision to keep Personal Wealth OS
 * structurally separate from the business system for now, while
 * staying trivially convergeable later (see config/personalOptions.js
 * and utils/jwt.js's PERSONAL WEALTH OS SESSIONS section).
 *
 * DynamoDB table layout:
 *
 *   br-personalSpaces  PK: personalUid (String) — one row per space.
 *                      { personalUid, ownerIdentityUid, fullName,
 *                      nickname, email, countryOfResidence,
 *                      phoneNumber, gender, primaryIncomeSource,
 *                      assetLocations: string[], monthlyIncomeBracket,
 *                      biggestFinancialHeadache, wantsWealthOpportunities,
 *                      createdAt, updatedAt }.
 *                      GSI: ownerIdentityUid-index (PK: ownerIdentityUid)
 *                           — "does this identity already have a
 *                           space" at onboarding, and the login picker.
 *
 *   br-personalAccounts   PK: personalUid + SK: accountId
 *   br-personalIncome     PK: personalUid + SK: incomeId
 *   br-personalExpenses   PK: personalUid + SK: expenseId
 *   br-personalAssets     PK: personalUid + SK: assetId
 *   br-personalGoals      PK: personalUid + SK: goalId
 *   br-personalDebts      PK: personalUid + SK: debtId
 *   br-personalDayLog     PK: personalUid + SK: entryId
 *
 *   br-personalAdvisorSessions  PK: personalUid — one continuous
 *                      advisor thread per space, identical design to
 *                      br-advisorSessions for businesses. No plan-
 *                      based memory pruning here (Personal Wealth OS
 *                      has no billing yet) — unlimited history for now.
 *
 *   br-personalNetWorthSnapshots  PK: personalUid + SK: date (String,
 *                      'YYYY-MM-DD'). One row per day, written lazily
 *                      the first time the Net Worth screen is opened
 *                      that day (see getOrCreateTodaySnapshot) — no
 *                      cron job, same lazy-computation approach
 *                      already used elsewhere in this codebase (e.g.
 *                      trial expiry). { personalUid, date, totalAssets,
 *                      totalLiabilities, netWorth, currency, createdAt }.
 *                      currency is always the platform's canonical
 *                      snapshot currency (NGN) regardless of what the
 *                      user's display toggle shows that day — trend
 *                      history must stay comparable across days even
 *                      if the user switches their display currency.
 *
 * ── ENVELOPE BUDGETING ──────────────────────────────────────────────
 * An income stream can be marked isEnvelope: true. An expense linked
 * to it via envelopeStreamId deducts from that stream's amountSpent
 * at creation and restores it at deletion — done with
 * TransactWriteCommand alongside the account-balance adjustment, so
 * an expense record, its envelope deduction, and its account
 * deduction can never partially apply (same reasoning as
 * db.service.js's atomic stock deduction on a sale).
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
} = require('@aws-sdk/lib-dynamodb');

const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');

const { v4: uuidv4 } = require('uuid');
const ApiError       = require('../utils/ApiError');
const { convertAmount } = require('../config/currencies');
const { DEFAULT_DISPLAY_CURRENCY } = require('../config/personalOptions');

// ── AWS clients — independent from db.service.js's, by design ──────
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const ddbClient = new DynamoDBClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const dynamo = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions:   { removeUndefinedValues: true },
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
  SPACES:            'br-personalSpaces',
  ACCOUNTS:          'br-personalAccounts',
  INCOME:            'br-personalIncome',
  EXPENSES:          'br-personalExpenses',
  ASSETS:            'br-personalAssets',
  GOALS:             'br-personalGoals',
  DEBTS:             'br-personalDebts',
  DAY_LOG:           'br-personalDayLog',
  ADVISOR:           'br-personalAdvisorSessions',
  NET_WORTH_SNAPSHOTS: 'br-personalNetWorthSnapshots',
};

// ── Helpers ───────────────────────────────────────────────────────
function nowISO() { return new Date().toISOString(); }
function newId()  { return uuidv4(); }

/**
 * buildUpdateExpr
 * Same small helper db.service.js uses — turns a plain updates object
 * into a DynamoDB UpdateExpression. Duplicated here rather than
 * imported, per this file's independence-from-db.service.js design.
 */
function buildUpdateExpr(updates) {
  const sets = [];
  const names = {};
  const values = {};
  for (const [key, val] of Object.entries(updates)) {
    if (val === undefined) continue;
    const nameKey  = `#${key}`;
    const valueKey = `:${key}`;
    sets.push(`${nameKey} = ${valueKey}`);
    names[nameKey]  = key;
    values[valueKey] = val;
  }
  return {
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  };
}

// ─────────────────────────────────────────────────────────────────
// PERSONAL SPACES
// ─────────────────────────────────────────────────────────────────

/**
 * createPersonalSpace
 * Called once, at the end of the 4-step onboarding wizard (mirrors
 * GYB's final step for businesses — see controllers/
 * personalOnboarding.controller.js for the identity-claiming logic
 * that happens alongside this).
 */
async function createPersonalSpace(personalUid, ownerIdentityUid, profile) {
  const now = nowISO();
  const item = {
    personalUid,
    ownerIdentityUid,
    fullName:                 profile.fullName                 || '',
    nickname:                 profile.nickname                 || '',
    email:                    profile.email                    || '',
    countryOfResidence:       profile.countryOfResidence        || '',
    phoneNumber:              profile.phoneNumber               || '',
    gender:                   profile.gender                    || '',
    primaryIncomeSource:      profile.primaryIncomeSource        || '',
    assetLocations:           profile.assetLocations             || [],
    monthlyIncomeBracket:     profile.monthlyIncomeBracket       || '',
    biggestFinancialHeadache: profile.biggestFinancialHeadache   || '',
    wantsWealthOpportunities: Boolean(profile.wantsWealthOpportunities),
    // The currency every screen in the dashboard displays totals in
    // by default — chosen at onboarding Step 1 (see
    // personalOnboarding.controller.js), changeable any time
    // afterward via updatePersonalSpace (PATCH /api/personal/profile
    // — see personalProfile.controller.js). This is a DISPLAY
    // preference only: it never rewrites any stored record's own
    // `currency` field, which stays exactly as the person entered it
    // (see personalNetWorth.controller.js's computeTotals for how
    // display-time conversion works).
    displayCurrency:          profile.displayCurrency            || DEFAULT_DISPLAY_CURRENCY,
    createdAt: now,
    updatedAt: now,
  };
  await dynamo.send(new PutCommand({ TableName: TABLES.SPACES, Item: item }));
  return item;
}

async function getPersonalSpace(personalUid) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLES.SPACES,
    Key:       { personalUid },
  }));
  return result.Item || null;
}

/**
 * getPersonalSpaceByIdentity
 * Used at onboarding (to prevent one identity creating a second
 * personal space by mistake) and at login (to decide whether to
 * offer a personal-space option in the "which space?" picker).
 * Requires a GSI named ownerIdentityUid-index on br-personalSpaces.
 */
async function getPersonalSpaceByIdentity(identityUid) {
  const result = await dynamo.send(new QueryCommand({
    TableName:                 TABLES.SPACES,
    IndexName:                 'ownerIdentityUid-index',
    KeyConditionExpression:    'ownerIdentityUid = :id',
    ExpressionAttributeValues: { ':id': identityUid },
  }));
  return (result.Items && result.Items[0]) || null;
}

async function updatePersonalSpace(personalUid, updates) {
  const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } =
    buildUpdateExpr({ ...updates, updatedAt: nowISO() });
  await dynamo.send(new UpdateCommand({
    TableName: TABLES.SPACES,
    Key:       { personalUid },
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
  }));
}

// ─────────────────────────────────────────────────────────────────
// ACCOUNTS
// ─────────────────────────────────────────────────────────────────

async function createAccount(personalUid, data) {
  const now = nowISO();
  const item = {
    personalUid,
    accountId:  newId(),
    name:       data.name,
    bankName:   data.bankName || '',
    accountNumberMask: data.accountNumberMask || '', // MASKED digits only — never store a full account number
    currency:   data.currency,
    balance:    Number(data.balance) || 0,
    type:       data.type,
    colorTag:   data.colorTag || '',
    createdAt:  now,
    updatedAt:  now,
  };
  await dynamo.send(new PutCommand({ TableName: TABLES.ACCOUNTS, Item: item }));
  return item;
}

async function getAccounts(personalUid) {
  const result = await dynamo.send(new QueryCommand({
    TableName:                 TABLES.ACCOUNTS,
    KeyConditionExpression:    'personalUid = :uid',
    ExpressionAttributeValues: { ':uid': personalUid },
  }));
  return result.Items || [];
}

async function getAccount(personalUid, accountId) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLES.ACCOUNTS,
    Key:       { personalUid, accountId },
  }));
  return result.Item || null;
}

async function updateAccount(personalUid, accountId, updates) {
  const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } =
    buildUpdateExpr({ ...updates, updatedAt: nowISO() });
  await dynamo.send(new UpdateCommand({
    TableName: TABLES.ACCOUNTS,
    Key:       { personalUid, accountId },
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
  }));
}

async function deleteAccount(personalUid, accountId) {
  await dynamo.send(new DeleteCommand({
    TableName: TABLES.ACCOUNTS,
    Key:       { personalUid, accountId },
  }));
}

/**
 * adjustAccountBalance
 * Internal helper — moves an account's balance by `deltaInOwnCurrency`
 * (positive = credit, negative = debit). Callers are responsible for
 * converting the triggering amount into the account's OWN currency
 * before calling this (see createExpense/deleteExpense/createIncome
 * below) — this function itself does no conversion, just the write.
 */
async function adjustAccountBalance(personalUid, accountId, deltaInOwnCurrency) {
  const account = await getAccount(personalUid, accountId);
  if (!account) return; // account may have been deleted since — non-fatal
  const nextBalance = Math.max(0, account.balance + deltaInOwnCurrency);
  await updateAccount(personalUid, accountId, { balance: nextBalance });
}

// ─────────────────────────────────────────────────────────────────
// INCOME
// ─────────────────────────────────────────────────────────────────

async function createIncome(personalUid, data) {
  const now = nowISO();
  const item = {
    personalUid,
    incomeId:   newId(),
    title:      data.title,
    type:       data.type,
    amount:     Number(data.amount),
    currency:   data.currency,
    frequency:  data.frequency,
    accountId:   data.accountId   || null,
    accountName: data.accountName || '',
    isEnvelope:       Boolean(data.isEnvelope),
    amountSpent:      0,   // always starts at 0 — only ever changed by linked-expense create/delete
    fundedCategories: [],
    notes:      data.notes || '',
    receiptUrl: null,
    dateReceived: data.dateReceived || now.slice(0, 10),
    tag:        data.tag || '',
    createdAt:  now,
    updatedAt:  now,
  };

  await dynamo.send(new PutCommand({ TableName: TABLES.INCOME, Item: item }));

  // Credit the linked account, if any — converted into the account's
  // own currency so a USD income landing in an NGN account still
  // updates that account's balance correctly.
  if (item.accountId) {
    const account = await getAccount(personalUid, item.accountId);
    if (account) {
      const creditInAccountCurrency = await convertAmount(item.amount, item.currency, account.currency);
      await adjustAccountBalance(personalUid, item.accountId, creditInAccountCurrency);
    }
  }

  return item;
}

async function getIncomeStreams(personalUid) {
  const result = await dynamo.send(new QueryCommand({
    TableName:                 TABLES.INCOME,
    KeyConditionExpression:    'personalUid = :uid',
    ExpressionAttributeValues: { ':uid': personalUid },
  }));
  return result.Items || [];
}

async function getIncomeStream(personalUid, incomeId) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLES.INCOME,
    Key:       { personalUid, incomeId },
  }));
  return result.Item || null;
}

async function updateIncome(personalUid, incomeId, updates) {
  // Deliberately excludes amountSpent/fundedCategories — those are
  // ONLY ever touched by the envelope deduction/restoration logic in
  // createExpense/deleteExpense below, never by a direct field edit,
  // so they can't drift out of sync with the expenses actually linked
  // to this stream.
  const safeUpdates = { ...updates };
  delete safeUpdates.amountSpent;
  delete safeUpdates.fundedCategories;

  const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } =
    buildUpdateExpr({ ...safeUpdates, updatedAt: nowISO() });
  await dynamo.send(new UpdateCommand({
    TableName: TABLES.INCOME,
    Key:       { personalUid, incomeId },
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
  }));
}

async function deleteIncome(personalUid, incomeId) {
  const income = await getIncomeStream(personalUid, incomeId);
  if (!income) return;

  // Reverse the original account credit, symmetric with createIncome.
  if (income.accountId) {
    const account = await getAccount(personalUid, income.accountId);
    if (account) {
      const debitInAccountCurrency = await convertAmount(income.amount, income.currency, account.currency);
      await adjustAccountBalance(personalUid, income.accountId, -debitInAccountCurrency);
    }
  }

  await dynamo.send(new DeleteCommand({
    TableName: TABLES.INCOME,
    Key:       { personalUid, incomeId },
  }));
}

// ─────────────────────────────────────────────────────────────────
// EXPENSES
// ─────────────────────────────────────────────────────────────────

/**
 * createExpense
 * A single TransactWriteCommand puts the expense AND (if applicable)
 * deducts the linked income envelope's amountSpent AND deducts the
 * linked account's balance — so an expense can never end up recorded
 * while only partially reflected elsewhere (same principle as the
 * atomic stock deduction on a business sale in db.service.js).
 */
async function createExpense(personalUid, data) {
  const now = nowISO();
  const expenseId = newId();
  const item = {
    personalUid,
    expenseId,
    title:      data.title,
    category:   data.category,
    amount:     Number(data.amount),
    currency:   data.currency,
    accountId:   data.accountId   || null,
    accountName: data.accountName || '',
    envelopeStreamId: data.envelopeStreamId || null,
    envelopeTitle:    data.envelopeTitle    || '',
    isBusinessReimbursement: Boolean(data.isBusinessReimbursement),
    reimbursementStatus: data.isBusinessReimbursement ? 'pending' : 'none',
    date:       data.date || now.slice(0, 10),
    notes:      data.notes || '',
    receiptUrl: null,
    createdAt:  now,
    updatedAt:  now,
  };

  const transactItems = [
    { Put: { TableName: TABLES.EXPENSES, Item: item } },
  ];

  // Pre-compute the two possible knock-on effects BEFORE building the
  // transaction — TransactWriteCommand can't read-then-write within
  // itself, so both target rows are fetched first, exactly like
  // db.service.js already does for sale-triggered stock deduction.
  let envelopeUpdate = null;
  if (item.envelopeStreamId) {
    const stream = await getIncomeStream(personalUid, item.envelopeStreamId);
    if (stream) {
      const deductionInStreamCurrency = await convertAmount(item.amount, item.currency, stream.currency);
      const nextSpent = (stream.amountSpent || 0) + deductionInStreamCurrency;
      const existingCategories = stream.fundedCategories || [];
      const nextCategories = existingCategories.includes(item.category)
        ? existingCategories
        : [...existingCategories, item.category];
      envelopeUpdate = { incomeId: item.envelopeStreamId, nextSpent, nextCategories };
    }
  }

  let accountUpdate = null;
  if (item.accountId) {
    const account = await getAccount(personalUid, item.accountId);
    if (account) {
      const deductionInAccountCurrency = await convertAmount(item.amount, item.currency, account.currency);
      const nextBalance = Math.max(0, account.balance - deductionInAccountCurrency);
      accountUpdate = { accountId: item.accountId, nextBalance };
    }
  }

  if (envelopeUpdate) {
    transactItems.push({
      Update: {
        TableName: TABLES.INCOME,
        Key:       { personalUid, incomeId: envelopeUpdate.incomeId },
        UpdateExpression: 'SET amountSpent = :s, fundedCategories = :c, updatedAt = :u',
        ExpressionAttributeValues: {
          ':s': envelopeUpdate.nextSpent,
          ':c': envelopeUpdate.nextCategories,
          ':u': now,
        },
      },
    });
  }

  if (accountUpdate) {
    transactItems.push({
      Update: {
        TableName: TABLES.ACCOUNTS,
        Key:       { personalUid, accountId: accountUpdate.accountId },
        UpdateExpression: 'SET balance = :b, updatedAt = :u',
        ExpressionAttributeValues: { ':b': accountUpdate.nextBalance, ':u': now },
      },
    });
  }

  await dynamo.send(new TransactWriteCommand({ TransactItems: transactItems }));
  return item;
}

async function getExpenses(personalUid) {
  const result = await dynamo.send(new QueryCommand({
    TableName:                 TABLES.EXPENSES,
    KeyConditionExpression:    'personalUid = :uid',
    ExpressionAttributeValues: { ':uid': personalUid },
  }));
  return result.Items || [];
}

async function getExpense(personalUid, expenseId) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLES.EXPENSES,
    Key:       { personalUid, expenseId },
  }));
  return result.Item || null;
}

/**
 * updateExpense
 * Field-level edits only (title, category, notes, date, reimbursement
 * fields) — deliberately does NOT allow changing amount/currency/
 * accountId/envelopeStreamId after creation. Re-balancing envelope and
 * account effects correctly on an amount/link change is exactly the
 * kind of "silent balance drift" risk this module exists to prevent —
 * the safe path for correcting an amount is delete + recreate, which
 * already reverses and reapplies everything correctly.
 */
async function updateExpense(personalUid, expenseId, updates) {
  const blocked = ['amount', 'currency', 'accountId', 'envelopeStreamId', 'personalUid', 'expenseId'];
  const safeUpdates = { ...updates };
  blocked.forEach(k => delete safeUpdates[k]);

  const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } =
    buildUpdateExpr({ ...safeUpdates, updatedAt: nowISO() });
  await dynamo.send(new UpdateCommand({
    TableName: TABLES.EXPENSES,
    Key:       { personalUid, expenseId },
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
  }));
}

async function toggleReimbursementStatus(personalUid, expenseId) {
  const expense = await getExpense(personalUid, expenseId);
  if (!expense) throw ApiError.badRequest('Expense not found.');
  const nextStatus = expense.reimbursementStatus === 'pending' ? 'reimbursed' : 'pending';
  await updateExpense(personalUid, expenseId, { reimbursementStatus: nextStatus });
}

/**
 * deleteExpense
 * Symmetric with createExpense — restores the envelope's amountSpent
 * and the account's balance in the same transaction as the delete.
 */
async function deleteExpense(personalUid, expenseId) {
  const expense = await getExpense(personalUid, expenseId);
  if (!expense) return;

  const now = nowISO();
  const transactItems = [
    { Delete: { TableName: TABLES.EXPENSES, Key: { personalUid, expenseId } } },
  ];

  if (expense.envelopeStreamId) {
    const stream = await getIncomeStream(personalUid, expense.envelopeStreamId);
    if (stream) {
      const restoredInStreamCurrency = await convertAmount(expense.amount, expense.currency, stream.currency);
      const nextSpent = Math.max(0, (stream.amountSpent || 0) - restoredInStreamCurrency);
      transactItems.push({
        Update: {
          TableName: TABLES.INCOME,
          Key:       { personalUid, incomeId: expense.envelopeStreamId },
          UpdateExpression: 'SET amountSpent = :s, updatedAt = :u',
          ExpressionAttributeValues: { ':s': nextSpent, ':u': now },
        },
      });
    }
  }

  if (expense.accountId) {
    const account = await getAccount(personalUid, expense.accountId);
    if (account) {
      const restoredInAccountCurrency = await convertAmount(expense.amount, expense.currency, account.currency);
      const nextBalance = account.balance + restoredInAccountCurrency;
      transactItems.push({
        Update: {
          TableName: TABLES.ACCOUNTS,
          Key:       { personalUid, accountId: expense.accountId },
          UpdateExpression: 'SET balance = :b, updatedAt = :u',
          ExpressionAttributeValues: { ':b': nextBalance, ':u': now },
        },
      });
    }
  }

  await dynamo.send(new TransactWriteCommand({ TransactItems: transactItems }));
}

// ── Receipts (income + expense share this) ─────────────────────────

async function uploadReceipt(personalUid, entryType, entryId, fileBuffer, originalname, mimetype) {
  const ext = originalname.split('.').pop().toLowerCase();
  const key = `personal-receipts/${personalUid}/${entryType}/${entryId}/receipt.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket:      S3_BUCKET,
    Key:         key,
    Body:        fileBuffer,
    ContentType: mimetype,
    // Receipts can contain sensitive financial details — private by
    // default, unlike inventory product photos. Served back to the
    // owner via a short-lived presigned URL, not a permanent public one.
  }));

  return key;
}

async function deleteReceipt(key) {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  } catch (err) {
    console.warn('[Personal] S3 receipt delete failed (non-fatal):', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// ASSETS
// ─────────────────────────────────────────────────────────────────

async function createAsset(personalUid, data) {
  const now = nowISO();
  const item = {
    personalUid,
    assetId:   newId(),
    name:      data.name,
    category:  data.category,
    estimatedValue:  data.isMarketTracked ? 0 : Number(data.estimatedValue), // market-tracked assets compute this at read time — see marketData.service.js
    currency:  data.currency,
    purchasePrice:    data.purchasePrice    != null ? Number(data.purchasePrice) : null,
    purchaseCurrency: data.purchaseCurrency || null,
    quantity:  data.quantity != null ? Number(data.quantity) : 1,
    serialNumber: data.serialNumber || '',
    liquidity: data.liquidity || 'short_term',
    imageUrl:  null,
    notes:     data.notes || '',
    location:  data.location || '',
    isMarketTracked: Boolean(data.isMarketTracked),
    marketSymbol:    data.marketSymbol   || null, // CoinGecko coin id, or a stock ticker
    marketAssetType: data.marketAssetType || null, // 'crypto' | 'stock' — tells marketData.service.js which provider to use
    createdAt: now,
    updatedAt: now,
  };
  await dynamo.send(new PutCommand({ TableName: TABLES.ASSETS, Item: item }));
  return item;
}

async function getAssets(personalUid) {
  const result = await dynamo.send(new QueryCommand({
    TableName:                 TABLES.ASSETS,
    KeyConditionExpression:    'personalUid = :uid',
    ExpressionAttributeValues: { ':uid': personalUid },
  }));
  return result.Items || [];
}

async function getAsset(personalUid, assetId) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLES.ASSETS,
    Key:       { personalUid, assetId },
  }));
  return result.Item || null;
}

async function updateAsset(personalUid, assetId, updates) {
  const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } =
    buildUpdateExpr({ ...updates, updatedAt: nowISO() });
  await dynamo.send(new UpdateCommand({
    TableName: TABLES.ASSETS,
    Key:       { personalUid, assetId },
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
  }));
}

async function deleteAsset(personalUid, assetId) {
  await dynamo.send(new DeleteCommand({
    TableName: TABLES.ASSETS,
    Key:       { personalUid, assetId },
  }));
}

// ─────────────────────────────────────────────────────────────────
// GOALS
// ─────────────────────────────────────────────────────────────────

async function createGoal(personalUid, data) {
  const now = nowISO();
  const item = {
    personalUid,
    goalId:      newId(),
    name:        data.name,
    category:    data.category,
    targetAmount: Number(data.targetAmount),
    currency:    data.currency,
    savedAmount: Number(data.savedAmount) || 0,
    targetDate:  data.targetDate,
    accountId:   data.accountId   || null,
    accountName: data.accountName || '',
    notes:       data.notes || '',
    createdAt:   now,
    updatedAt:   now,
  };
  await dynamo.send(new PutCommand({ TableName: TABLES.GOALS, Item: item }));
  return item;
}

async function getGoals(personalUid) {
  const result = await dynamo.send(new QueryCommand({
    TableName:                 TABLES.GOALS,
    KeyConditionExpression:    'personalUid = :uid',
    ExpressionAttributeValues: { ':uid': personalUid },
  }));
  return result.Items || [];
}

async function getGoal(personalUid, goalId) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLES.GOALS,
    Key:       { personalUid, goalId },
  }));
  return result.Item || null;
}

async function updateGoal(personalUid, goalId, updates) {
  const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } =
    buildUpdateExpr({ ...updates, updatedAt: nowISO() });
  await dynamo.send(new UpdateCommand({
    TableName: TABLES.GOALS,
    Key:       { personalUid, goalId },
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
  }));
}

async function updateGoalSavedAmount(personalUid, goalId, newSavedAmount) {
  await updateGoal(personalUid, goalId, { savedAmount: Math.max(0, Number(newSavedAmount)) });
}

async function deleteGoal(personalUid, goalId) {
  await dynamo.send(new DeleteCommand({
    TableName: TABLES.GOALS,
    Key:       { personalUid, goalId },
  }));
}

// ─────────────────────────────────────────────────────────────────
// DEBTS & IOUs
// ─────────────────────────────────────────────────────────────────

async function createDebt(personalUid, data) {
  const now = nowISO();
  const item = {
    personalUid,
    debtId:        newId(),
    type:          data.type, // 'i_owe' | 'owed_to_me'
    personOrEntity: data.personOrEntity,
    phoneNumber:   data.phoneNumber || '',
    amount:        Number(data.amount),
    currency:      data.currency,
    paidAmount:    0,
    purpose:       data.purpose || '',
    dueDate:       data.dueDate,
    isSettled:     false,
    settledDate:   null,
    notes:         data.notes || '',
    createdAt:     now,
    updatedAt:     now,
  };
  await dynamo.send(new PutCommand({ TableName: TABLES.DEBTS, Item: item }));
  return item;
}

async function getDebts(personalUid) {
  const result = await dynamo.send(new QueryCommand({
    TableName:                 TABLES.DEBTS,
    KeyConditionExpression:    'personalUid = :uid',
    ExpressionAttributeValues: { ':uid': personalUid },
  }));
  return result.Items || [];
}

async function getDebt(personalUid, debtId) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLES.DEBTS,
    Key:       { personalUid, debtId },
  }));
  return result.Item || null;
}

async function updateDebt(personalUid, debtId, updates) {
  const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } =
    buildUpdateExpr({ ...updates, updatedAt: nowISO() });
  await dynamo.send(new UpdateCommand({
    TableName: TABLES.DEBTS,
    Key:       { personalUid, debtId },
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
  }));
}

async function toggleSettleDebt(personalUid, debtId) {
  const debt = await getDebt(personalUid, debtId);
  if (!debt) throw ApiError.badRequest('Debt record not found.');
  const nextSettled = !debt.isSettled;
  await updateDebt(personalUid, debtId, {
    isSettled:   nextSettled,
    settledDate: nextSettled ? nowISO().slice(0, 10) : null,
    paidAmount:  nextSettled ? debt.amount : debt.paidAmount,
  });
}

async function logPartialPayment(personalUid, debtId, additionalPaid) {
  const debt = await getDebt(personalUid, debtId);
  if (!debt) throw ApiError.badRequest('Debt record not found.');
  const totalPaid  = Math.min(debt.amount, (debt.paidAmount || 0) + Number(additionalPaid));
  const isSettled  = totalPaid >= debt.amount;
  await updateDebt(personalUid, debtId, {
    paidAmount:  totalPaid,
    isSettled,
    settledDate: isSettled ? nowISO().slice(0, 10) : debt.settledDate,
  });
}

async function deleteDebt(personalUid, debtId) {
  await dynamo.send(new DeleteCommand({
    TableName: TABLES.DEBTS,
    Key:       { personalUid, debtId },
  }));
}

// ─────────────────────────────────────────────────────────────────
// DAY LOG (Financial Journal)
// ─────────────────────────────────────────────────────────────────

/**
 * createDayLogEntry
 * `parsedCash`/`parsedPromise` are pre-computed by the caller (see
 * controllers/personalDayLog.controller.js, which calls
 * wealthAdvisor.service.js's AI extraction BEFORE calling this) — this
 * function only persists whatever structured result was already
 * produced, it does no parsing itself.
 */
async function createDayLogEntry(personalUid, data) {
  const now = nowISO();
  const item = {
    personalUid,
    entryId:  newId(),
    content:  data.content,
    date:     data.date || now,
    tags:     data.tags || [],
    parsedCash:    data.parsedCash    || null, // { amount, currency, description, movedToExpenses }
    parsedPromise: data.parsedPromise || null, // { personOrEntity, amount, currency, dueDate, description, isReminderSet }
    createdAt: now,
  };
  await dynamo.send(new PutCommand({ TableName: TABLES.DAY_LOG, Item: item }));
  return item;
}

async function getDayLogEntries(personalUid) {
  const result = await dynamo.send(new QueryCommand({
    TableName:                 TABLES.DAY_LOG,
    KeyConditionExpression:    'personalUid = :uid',
    ExpressionAttributeValues: { ':uid': personalUid },
  }));
  return result.Items || [];
}

async function getDayLogEntry(personalUid, entryId) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLES.DAY_LOG,
    Key:       { personalUid, entryId },
  }));
  return result.Item || null;
}

async function markCashMovedToExpenses(personalUid, entryId) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLES.DAY_LOG,
    Key:       { personalUid, entryId },
  }));
  const entry = result.Item;
  if (!entry || !entry.parsedCash) return;

  await dynamo.send(new UpdateCommand({
    TableName: TABLES.DAY_LOG,
    Key:       { personalUid, entryId },
    UpdateExpression: 'SET parsedCash.movedToExpenses = :m',
    ExpressionAttributeValues: { ':m': true },
  }));
}

async function toggleReminderSet(personalUid, entryId) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLES.DAY_LOG,
    Key:       { personalUid, entryId },
  }));
  const entry = result.Item;
  if (!entry || !entry.parsedPromise) return;

  await dynamo.send(new UpdateCommand({
    TableName: TABLES.DAY_LOG,
    Key:       { personalUid, entryId },
    UpdateExpression: 'SET parsedPromise.isReminderSet = :r',
    ExpressionAttributeValues: { ':r': !entry.parsedPromise.isReminderSet },
  }));
}

async function deleteDayLogEntry(personalUid, entryId) {
  await dynamo.send(new DeleteCommand({
    TableName: TABLES.DAY_LOG,
    Key:       { personalUid, entryId },
  }));
}

// ─────────────────────────────────────────────────────────────────
// ADVISOR SESSIONS
// ─────────────────────────────────────────────────────────────────
// Identical design to business advisor sessions (one continuous
// thread per space) — no memory-day pruning, since Personal Wealth OS
// has no billing tiers yet. Revisit if storage/abuse ever becomes a
// real concern.

async function getPersonalAdvisorHistory(personalUid) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLES.ADVISOR,
    Key:       { personalUid },
  }));
  return (result.Item && result.Item.messages) || [];
}

async function appendPersonalAdvisorMessages(personalUid, messages) {
  const now = nowISO();
  const existing = await dynamo.send(new GetCommand({
    TableName: TABLES.ADVISOR,
    Key:       { personalUid },
  }));

  if (existing.Item) {
    await dynamo.send(new UpdateCommand({
      TableName: TABLES.ADVISOR,
      Key:       { personalUid },
      UpdateExpression: 'SET messages = :m, updatedAt = :u',
      ExpressionAttributeValues: { ':m': messages, ':u': now },
    }));
  } else {
    await dynamo.send(new PutCommand({
      TableName: TABLES.ADVISOR,
      Item: { personalUid, messages, createdAt: now, updatedAt: now },
    }));
  }
}

async function clearPersonalAdvisorHistory(personalUid) {
  await dynamo.send(new DeleteCommand({
    TableName: TABLES.ADVISOR,
    Key:       { personalUid },
  }));
}

// ─────────────────────────────────────────────────────────────────
// NET WORTH SNAPSHOTS
// ─────────────────────────────────────────────────────────────────

async function getSnapshot(personalUid, date) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLES.NET_WORTH_SNAPSHOTS,
    Key:       { personalUid, date },
  }));
  return result.Item || null;
}

async function saveSnapshot(personalUid, date, totals) {
  const item = {
    personalUid,
    date, // 'YYYY-MM-DD'
    totalAssets:      totals.totalAssets,
    totalLiabilities: totals.totalLiabilities,
    netWorth:         totals.netWorth,
    currency:         'NGN', // canonical snapshot currency — see table-layout comment above
    createdAt:        nowISO(),
  };
  await dynamo.send(new PutCommand({ TableName: TABLES.NET_WORTH_SNAPSHOTS, Item: item }));
  return item;
}

/**
 * getSnapshotHistory
 * Chronological (oldest→newest is NOT guaranteed by Query order alone
 * without ScanIndexForward — set explicitly here) list of snapshots,
 * for charting a real trend. `limit` bounds how far back to look.
 */
async function getSnapshotHistory(personalUid, limit = 90) {
  const result = await dynamo.send(new QueryCommand({
    TableName:                 TABLES.NET_WORTH_SNAPSHOTS,
    KeyConditionExpression:    'personalUid = :uid',
    ExpressionAttributeValues: { ':uid': personalUid },
    ScanIndexForward:          true, // ascending by date (the sort key)
    Limit:                     limit,
  }));
  return result.Items || [];
}

// ─────────────────────────────────────────────────────────────────
// ONBOARDING SESSIONS (staging area for the 4-step wizard)
// ─────────────────────────────────────────────────────────────────
// br-personalOnboardingSessions  PK: sessionId (String). Mirrors GYB's
// session-doc pattern in db.service.js exactly (same idempotent-
// update / recovery-doc behavior) — but in its OWN table rather than
// reusing br-users, since a not-yet-completed personal signup has no
// business being anything close to an identity yet, unlike GYB's temp
// row (which briefly borrows br-users because it's one step away from
// becoming a real one). Deleted once step 4 completes.

const ONBOARDING_SESSIONS_TABLE = 'br-personalOnboardingSessions';

async function createOnboardingSession(sessionId, data) {
  const existing = await dynamo.send(new GetCommand({
    TableName: ONBOARDING_SESSIONS_TABLE,
    Key:       { sessionId },
  }));

  const now = nowISO();

  if (existing.Item) {
    // Idempotent — a duplicate step-1 submission just refreshes it.
    const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } =
      buildUpdateExpr({ ...data, updatedAt: now });
    await dynamo.send(new UpdateCommand({
      TableName: ONBOARDING_SESSIONS_TABLE,
      Key:       { sessionId },
      UpdateExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
    }));
    return;
  }

  await dynamo.send(new PutCommand({
    TableName: ONBOARDING_SESSIONS_TABLE,
    Item: {
      sessionId,
      ...data,
      onboardingStep: 1,
      createdAt: now,
      updatedAt: now,
    },
  }));
}

async function updateOnboardingSession(sessionId, data) {
  const existing = await dynamo.send(new GetCommand({
    TableName: ONBOARDING_SESSIONS_TABLE,
    Key:       { sessionId },
  }));

  const now = nowISO();

  if (!existing.Item) {
    // Same recovery behavior as GYB — don't hard-fail a step-2/3
    // submission just because step 1's write is somehow missing.
    console.warn(`[Personal] updateOnboardingSession: session ${sessionId} not found — creating recovery doc`);
    await dynamo.send(new PutCommand({
      TableName: ONBOARDING_SESSIONS_TABLE,
      Item: { sessionId, ...data, createdAt: now, updatedAt: now },
    }));
    return;
  }

  const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } =
    buildUpdateExpr({ ...data, updatedAt: now });
  await dynamo.send(new UpdateCommand({
    TableName: ONBOARDING_SESSIONS_TABLE,
    Key:       { sessionId },
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
  }));
}

async function getOnboardingSession(sessionId) {
  const result = await dynamo.send(new GetCommand({
    TableName: ONBOARDING_SESSIONS_TABLE,
    Key:       { sessionId },
  }));
  return result.Item || null;
}

async function deleteOnboardingSession(sessionId) {
  await dynamo.send(new DeleteCommand({
    TableName: ONBOARDING_SESSIONS_TABLE,
    Key:       { sessionId },
  }));
}

module.exports = {
  TABLES,
  // Onboarding sessions
  createOnboardingSession, updateOnboardingSession, getOnboardingSession, deleteOnboardingSession,
  // Spaces
  createPersonalSpace, getPersonalSpace, getPersonalSpaceByIdentity, updatePersonalSpace,
  // Accounts
  createAccount, getAccounts, getAccount, updateAccount, deleteAccount,
  // Income
  createIncome, getIncomeStreams, getIncomeStream, updateIncome, deleteIncome,
  // Expenses
  createExpense, getExpenses, getExpense, updateExpense, deleteExpense, toggleReimbursementStatus,
  uploadReceipt, deleteReceipt,
  // Assets
  createAsset, getAssets, getAsset, updateAsset, deleteAsset,
  // Goals
  createGoal, getGoals, getGoal, updateGoal, updateGoalSavedAmount, deleteGoal,
  // Debts
  createDebt, getDebts, getDebt, updateDebt, toggleSettleDebt, logPartialPayment, deleteDebt,
  // Day Log
  createDayLogEntry, getDayLogEntries, getDayLogEntry, markCashMovedToExpenses, toggleReminderSet, deleteDayLogEntry,
  // Advisor
  getPersonalAdvisorHistory, appendPersonalAdvisorMessages, clearPersonalAdvisorHistory,
  // Net worth snapshots
  getSnapshot, saveSnapshot, getSnapshotHistory,
};
