/**
 * scripts/setup-personal-tables.js
 *
 * Creates every DynamoDB table Personal Wealth OS needs, across every
 * phase of the build (including ones not wired up in code yet, like
 * br-marketPriceCache for Phase 5) — so this only ever needs to be run
 * ONCE, well ahead of when the frontend actually starts calling any
 * of it. None of these tables overlap with or modify the existing
 * business tables (br-businesses, br-inventory, etc.) in any way.
 *
 * SAFE TO RE-RUN: checks each table's existence first (DescribeTable)
 * and skips it if already there — a repeat run only fills in whatever
 * is still missing, never recreates or touches existing data. Same
 * partial-success-tolerant philosophy as scripts/setup-paystack-
 * plans.js: one table failing doesn't block the others, and the
 * final summary tells you exactly what still needs attention.
 *
 * Billing mode: PAY_PER_REQUEST (on-demand) for every table — no
 * capacity planning needed, matches a workload with unpredictable,
 * per-user-driven traffic far better than a fixed RCU/WCU provision.
 *
 * Requires AWS credentials with dynamodb:CreateTable / :DescribeTable
 * / :UpdateTable permissions (the same credentials already used by
 * AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in .env for everything
 * else this app talks to DynamoDB with).
 *
 * Run:
 *   node scripts/setup-personal-tables.js
 */

'use strict';

require('dotenv').config();

const {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  UpdateTableCommand,
  waitUntilTableExists,
} = require('@aws-sdk/client-dynamodb');

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const client = new DynamoDBClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ── Table definitions ────────────────────────────────────────────
// Each entry: { name, keySchema, attributeDefinitions, gsi? }
// keySchema/attributeDefinitions follow the AWS SDK's own shape
// directly, so they can be passed straight into CreateTableCommand.

const TABLE_DEFINITIONS = [
  {
    name: 'br-personalSpaces',
    keySchema: [{ AttributeName: 'personalUid', KeyType: 'HASH' }],
    attributeDefinitions: [
      { AttributeName: 'personalUid',      AttributeType: 'S' },
      { AttributeName: 'ownerIdentityUid', AttributeType: 'S' },
    ],
    gsi: [{
      IndexName: 'ownerIdentityUid-index',
      KeySchema: [{ AttributeName: 'ownerIdentityUid', KeyType: 'HASH' }],
      Projection: { ProjectionType: 'ALL' },
    }],
  },
  {
    name: 'br-personalAccounts',
    keySchema: [
      { AttributeName: 'personalUid', KeyType: 'HASH' },
      { AttributeName: 'accountId',   KeyType: 'RANGE' },
    ],
    attributeDefinitions: [
      { AttributeName: 'personalUid', AttributeType: 'S' },
      { AttributeName: 'accountId',   AttributeType: 'S' },
    ],
  },
  {
    name: 'br-personalIncome',
    keySchema: [
      { AttributeName: 'personalUid', KeyType: 'HASH' },
      { AttributeName: 'incomeId',    KeyType: 'RANGE' },
    ],
    attributeDefinitions: [
      { AttributeName: 'personalUid', AttributeType: 'S' },
      { AttributeName: 'incomeId',    AttributeType: 'S' },
    ],
  },
  {
    name: 'br-personalExpenses',
    keySchema: [
      { AttributeName: 'personalUid', KeyType: 'HASH' },
      { AttributeName: 'expenseId',   KeyType: 'RANGE' },
    ],
    attributeDefinitions: [
      { AttributeName: 'personalUid', AttributeType: 'S' },
      { AttributeName: 'expenseId',   AttributeType: 'S' },
    ],
  },
  {
    name: 'br-personalAssets',
    keySchema: [
      { AttributeName: 'personalUid', KeyType: 'HASH' },
      { AttributeName: 'assetId',     KeyType: 'RANGE' },
    ],
    attributeDefinitions: [
      { AttributeName: 'personalUid', AttributeType: 'S' },
      { AttributeName: 'assetId',     AttributeType: 'S' },
    ],
  },
  {
    name: 'br-personalGoals',
    keySchema: [
      { AttributeName: 'personalUid', KeyType: 'HASH' },
      { AttributeName: 'goalId',      KeyType: 'RANGE' },
    ],
    attributeDefinitions: [
      { AttributeName: 'personalUid', AttributeType: 'S' },
      { AttributeName: 'goalId',      AttributeType: 'S' },
    ],
  },
  {
    name: 'br-personalDebts',
    keySchema: [
      { AttributeName: 'personalUid', KeyType: 'HASH' },
      { AttributeName: 'debtId',      KeyType: 'RANGE' },
    ],
    attributeDefinitions: [
      { AttributeName: 'personalUid', AttributeType: 'S' },
      { AttributeName: 'debtId',      AttributeType: 'S' },
    ],
  },
  {
    name: 'br-personalDayLog',
    keySchema: [
      { AttributeName: 'personalUid', KeyType: 'HASH' },
      { AttributeName: 'entryId',     KeyType: 'RANGE' },
    ],
    attributeDefinitions: [
      { AttributeName: 'personalUid', AttributeType: 'S' },
      { AttributeName: 'entryId',     AttributeType: 'S' },
    ],
  },
  {
    // One row per space — same design as br-advisorSessions for businesses.
    name: 'br-personalAdvisorSessions',
    keySchema: [{ AttributeName: 'personalUid', KeyType: 'HASH' }],
    attributeDefinitions: [{ AttributeName: 'personalUid', AttributeType: 'S' }],
  },
  {
    name: 'br-personalNetWorthSnapshots',
    keySchema: [
      { AttributeName: 'personalUid', KeyType: 'HASH' },
      { AttributeName: 'date',        KeyType: 'RANGE' }, // 'YYYY-MM-DD'
    ],
    attributeDefinitions: [
      { AttributeName: 'personalUid', AttributeType: 'S' },
      { AttributeName: 'date',        AttributeType: 'S' },
    ],
  },
  {
    // Staging area for the 4-step onboarding wizard — see
    // services/personal.service.js's ONBOARDING SESSIONS section.
    name: 'br-personalOnboardingSessions',
    keySchema: [{ AttributeName: 'sessionId', KeyType: 'HASH' }],
    attributeDefinitions: [{ AttributeName: 'sessionId', AttributeType: 'S' }],
  },
  {
    // Phase 5 (market data) — not wired into any controller yet, but
    // created now so nothing blocks that phase later. PK combines
    // provider + symbol (e.g. "coingecko:bitcoin", "finnhub:AAPL") so
    // a crypto id and a stock ticker can never collide.
    name: 'br-marketPriceCache',
    keySchema: [{ AttributeName: 'symbol', KeyType: 'HASH' }],
    attributeDefinitions: [{ AttributeName: 'symbol', AttributeType: 'S' }],
  },
];

// ── Helpers ───────────────────────────────────────────────────────

async function tableExists(name) {
  try {
    const result = await client.send(new DescribeTableCommand({ TableName: name }));
    return result.Table;
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') return null;
    throw err;
  }
}

async function createTable(def) {
  const params = {
    TableName:            def.name,
    KeySchema:            def.keySchema,
    AttributeDefinitions: def.attributeDefinitions,
    BillingMode:          'PAY_PER_REQUEST',
  };
  if (def.gsi) {
    params.GlobalSecondaryIndexes = def.gsi;
  }
  await client.send(new CreateTableCommand(params));
  await waitUntilTableExists({ client, maxWaitTime: 120 }, { TableName: def.name });
}

/**
 * Adds any GSI that's defined in the table def but missing from an
 * already-existing table — handles the "re-run after the schema grew
 * a new index" case. DynamoDB only allows one GSI change per
 * UpdateTable call, and each one takes real time to backfill, so
 * these run sequentially and are awaited one at a time.
 */
async function ensureIndexes(def, existingTable) {
  if (!def.gsi) return;
  const existingIndexNames = (existingTable.GlobalSecondaryIndexes || []).map(i => i.IndexName);

  for (const gsi of def.gsi) {
    if (existingIndexNames.includes(gsi.IndexName)) continue;

    console.log(`  + Adding missing index "${gsi.IndexName}" to ${def.name}...`);
    await client.send(new UpdateTableCommand({
      TableName: def.name,
      AttributeDefinitions: def.attributeDefinitions,
      GlobalSecondaryIndexUpdates: [{ Create: gsi }],
    }));
    await waitUntilTableExists({ client, maxWaitTime: 180 }, { TableName: def.name });
    console.log(`  ✓ Index "${gsi.IndexName}" is active on ${def.name}`);
  }
}

// ── Run ───────────────────────────────────────────────────────────

async function run() {
  console.log('Setting up Personal Wealth OS DynamoDB tables');
  console.log('================================================================================');

  const failures = [];

  for (const def of TABLE_DEFINITIONS) {
    try {
      const existing = await tableExists(def.name);

      if (existing) {
        console.log(`✓ ${def.name} already exists — checking indexes...`);
        await ensureIndexes(def, existing);
        continue;
      }

      console.log(`+ Creating ${def.name}...`);
      await createTable(def);
      console.log(`✓ ${def.name} created and active.`);
    } catch (err) {
      console.error(`✗ ${def.name} FAILED: ${err.message}`);
      failures.push(def.name);
    }
  }

  console.log('================================================================================');

  if (failures.length > 0) {
    console.log(`\n⚠ ${failures.length} table(s) did not get set up: ${failures.join(', ')}`);
    console.log('Check your AWS credentials/permissions and re-run — this script is safe to run again.');
    process.exit(1);
  }

  console.log('\nAll Personal Wealth OS tables are ready.');
}

run().catch(err => {
  console.error('\nSetup FAILED unexpectedly:', err.message);
  process.exit(1);
});
