/**
 * config/database.js
 *
 * AWS SDK clients for DynamoDB and S3.
 * Drop-in replacement for config/firebase.js.
 *
 * Required environment variables:
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   AWS_REGION           (default: us-east-1)
 *   AWS_S3_BUCKET        (your S3 bucket name for inventory images)
 *
 * Usage:
 *   const { dynamo, s3 } = require('../config/database');
 *   (used internally by db.service.js — controllers never import this directly)
 */

'use strict';

const { DynamoDBClient }          = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient }  = require('@aws-sdk/lib-dynamodb');
const { S3Client }                = require('@aws-sdk/client-s3');

const requiredVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_S3_BUCKET'];
for (const v of requiredVars) {
  if (!process.env[v]) throw new Error(`[DB] ${v} is not set. Check your .env file.`);
}

const credentials = {
  accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};
const region = process.env.AWS_REGION || 'us-east-1';

const ddbRaw = new DynamoDBClient({ region, credentials });

const dynamo = DynamoDBDocumentClient.from(ddbRaw, {
  marshallOptions:   { removeUndefinedValues: true },
  unmarshallOptions: { wrapNumbers: false },
});

const s3 = new S3Client({ region, credentials });

console.log(`[DB] AWS clients initialised — region: ${region}`);

module.exports = { dynamo, s3 };
