/**
 * services/contact.service.js
 *
 * DB layer for the "lay a complaint / drop a suggestion" contact
 * feature — one shared table backing all three entry points (home
 * page, Business OS, Personal Wealth OS). See controllers/
 * contact.controller.js for the single endpoint that writes here.
 *
 * DynamoDB table:
 *   br-contactSubmissions   PK: submissionId (String)
 *     { submissionId, createdAt, source: 'home'|'business'|'personal',
 *       category: 'complaint'|'suggestion'|'bug'|'other', message,
 *       name, email, context: object|null, status: 'new'|'resolved' }
 *   GSI: status-index (PK: status, SK: createdAt) — lets a future
 *        admin view (or, for now, a direct query — no admin UI
 *        exists yet, per this feature's scope) pull every 'new'
 *        submission in time order without a full table scan.
 *
 * `context` is null for an anonymous home-page submission, and an
 * object (identity/business/personal details) when the submitter was
 * logged in — see contact.controller.js's buildContext for exactly
 * what's captured. It is NEVER used for anything except display in
 * the notification email and this table — it doesn't drive any
 * access-control decision, so it's stored as a plain nested object
 * rather than needing its own shape validation.
 *
 * Own isolated DynamoDB client (not db.service.js's) — same
 * precedent as personal.service.js and marketData.service.js: a new
 * feature domain gets its own small service file rather than growing
 * the already-large db.service.js further.
 */

'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

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

const TABLE = 'br-contactSubmissions';

function nowISO() { return new Date().toISOString(); }
function newId()  { return uuidv4(); }

/**
 * createSubmission
 * @param {Object} data
 * @param {string} data.source    'home' | 'business' | 'personal'
 * @param {string} data.category  'complaint' | 'suggestion' | 'bug' | 'other'
 * @param {string} data.message
 * @param {string} data.name
 * @param {string} data.email
 * @param {Object|null} data.context  Logged-in account context, or null
 * @returns {Promise<Object>} the full stored item, including submissionId
 */
async function createSubmission(data) {
  const now = nowISO();
  const item = {
    submissionId: newId(),
    createdAt:    now,
    source:       data.source,
    category:     data.category,
    message:      data.message,
    name:         data.name,
    email:        data.email,
    context:      data.context || null,
    status:       'new',
  };
  await dynamo.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

/**
 * listSubmissionsByStatus
 * Not wired to any route yet (no admin UI exists — see this file's
 * header) but included now so a future admin view, or a one-off
 * manual query, doesn't need a schema change to work — exactly the
 * "queryable later, even with no UI yet" requirement this feature
 * was scoped to.
 *
 * @param {string} status  'new' | 'resolved'
 * @param {number} [limit]
 * @returns {Promise<Object[]>} newest first
 */
async function listSubmissionsByStatus(status, limit = 50) {
  const result = await dynamo.send(new QueryCommand({
    TableName:                 TABLE,
    IndexName:                 'status-index',
    KeyConditionExpression:    'status = :status',
    ExpressionAttributeValues: { ':status': status },
    ScanIndexForward:          false, // newest createdAt first
    Limit:                     limit,
  }));
  return result.Items || [];
}

/**
 * updateSubmissionStatus
 * @param {string} submissionId
 * @param {string} status  'new' | 'resolved'
 */
async function updateSubmissionStatus(submissionId, status) {
  await dynamo.send(new UpdateCommand({
    TableName:                 TABLE,
    Key:                       { submissionId },
    UpdateExpression:          'SET #status = :status, updatedAt = :now',
    ExpressionAttributeNames:  { '#status': 'status' }, // 'status' is a DynamoDB reserved word
    ExpressionAttributeValues: { ':status': status, ':now': nowISO() },
  }));
}

module.exports = { createSubmission, listSubmissionsByStatus, updateSubmissionStatus };
