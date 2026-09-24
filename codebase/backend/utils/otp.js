/**
 * utils/otp.js
 *
 * OTP generation, storage, and verification for password reset.
 *
 * ── MIGRATED FROM FIRESTORE TO DYNAMODB ────────────────────────────
 * This file previously read/wrote Firestore directly
 * (`require('../config/firebase')`, `db.collection('otpCodes')`) —
 * the last real Firebase dependency left in the codebase after the
 * AWS migration. It now uses the same shared DynamoDB client every
 * other service uses (`config/database.js`).
 *
 * Exported function signatures and return shapes are UNCHANGED —
 * otp.controller.js requires no changes.
 * ─────────────────────────────────────────────────────────────────
 *
 * FLOW:
 *   1. POST /api/auth/otp/request  → generate code, store in DynamoDB, send email
 *   2. POST /api/auth/otp/verify   → check code, mark verified
 *   3. POST /api/auth/otp/reset    → verify token from step 2, update password
 *
 * DYNAMODB TABLE: br-otpCodes
 *   PK: email (String) — one item per email, overwritten on each new
 *   request. This means a new OTP request automatically invalidates
 *   the previous one (PutCommand fully replaces the item, same
 *   overwrite behavior as the old Firestore .set()).
 *
 * ITEM SHAPE:
 *   {
 *     email:      string,     // normalised lowercase — partition key
 *     code:       string,     // 6-digit string (stored as string, not number)
 *     expiresAt:  number,     // epoch ms — 15 minutes from creation
 *     ttl:        number,     // epoch SECONDS — DynamoDB native TTL cleanup
 *                             // (needs TTL enabled on the table, attribute "ttl" —
 *                             //  a bonus over the old Firestore setup, which had
 *                             //  no automatic expiry cleanup at all)
 *     attempts:   number,     // wrong guesses so far (max 5)
 *     verified:   boolean,    // true after correct code entered
 *     resetToken: string|null,// random token issued after verification
 *     createdAt:  string,     // ISO timestamp
 *   }
 *
 * SECURITY DECISIONS (unchanged from the Firestore version):
 *   - Code stored as a string, not hashed — 6 digits with max 5 attempts
 *     and 15-minute expiry provides sufficient security without the
 *     complexity of hashing short codes.
 *   - resetToken is a 32-byte hex string — long enough to be unguessable,
 *     short-lived (used once to set password, then item deleted).
 *   - Attempts capped at 5 — brute forcing 1,000,000 codes in 5 tries
 *     is computationally impossible.
 */

'use strict';

const crypto = require('crypto');
const { dynamo } = require('../config/database');
const {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} = require('@aws-sdk/lib-dynamodb');

const OTP_TABLE      = 'br-otpCodes';
const OTP_EXPIRY_MS  = 15 * 60 * 1000;  // 15 minutes
const MAX_ATTEMPTS   = 5;

// ── Generate a 6-digit OTP ────────────────────────────────────────
function generateCode() {
  // crypto.randomInt is cryptographically secure
  return String(crypto.randomInt(100000, 999999));
}

// ── Generate a secure reset token ────────────────────────────────
function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ── Store OTP in DynamoDB ──────────────────────────────────────────
/**
 * Creates or overwrites the OTP item for an email.
 * Overwrites invalidate any previous unused code automatically.
 *
 * @param {string} email  Normalised email
 * @returns {string}      The generated code (to be emailed)
 */
async function storeOTP(email) {
  const code       = generateCode();
  const expiresAt  = Date.now() + OTP_EXPIRY_MS;

  await dynamo.send(new PutCommand({
    TableName: OTP_TABLE,
    Item: {
      email,
      code,
      expiresAt,
      ttl:        Math.floor(expiresAt / 1000) + 3600, // 1hr grace period past expiry
      attempts:   0,
      verified:   false,
      resetToken: null,
      createdAt:  new Date().toISOString(),
    },
  }));

  return code;
}

// ── Verify OTP ────────────────────────────────────────────────────
/**
 * Checks the submitted code against the stored one.
 *
 * Returns one of:
 *   { success: true,  resetToken: string }   — code correct
 *   { success: false, reason: 'expired' }    — past 15 min
 *   { success: false, reason: 'max_attempts' }
 *   { success: false, reason: 'invalid',
 *     attemptsLeft: number }                 — wrong code
 *   { success: false, reason: 'not_found' }  — no OTP requested
 *
 * @param {string} email
 * @param {string} code   6-digit string submitted by the user
 */
async function verifyOTP(email, code) {
  const { Item: data } = await dynamo.send(new GetCommand({
    TableName: OTP_TABLE,
    Key: { email },
  }));

  if (!data) {
    return { success: false, reason: 'not_found' };
  }

  // Check expiry
  if (Date.now() > data.expiresAt) {
    await dynamo.send(new DeleteCommand({ TableName: OTP_TABLE, Key: { email } }));
    return { success: false, reason: 'expired' };
  }

  // Check attempt cap
  if (data.attempts >= MAX_ATTEMPTS) {
    await dynamo.send(new DeleteCommand({ TableName: OTP_TABLE, Key: { email } }));
    return { success: false, reason: 'max_attempts' };
  }

  // Wrong code — increment attempts
  if (data.code !== String(code).trim()) {
    await dynamo.send(new UpdateCommand({
      TableName:                 OTP_TABLE,
      Key:                       { email },
      UpdateExpression:          'ADD attempts :one',
      ExpressionAttributeValues: { ':one': 1 },
    }));
    const attemptsLeft = MAX_ATTEMPTS - (data.attempts + 1);
    return { success: false, reason: 'invalid', attemptsLeft };
  }

  // Correct — issue a one-time reset token and mark verified
  const resetToken = generateResetToken();
  await dynamo.send(new UpdateCommand({
    TableName:                 OTP_TABLE,
    Key:                       { email },
    UpdateExpression:          'SET verified = :v, resetToken = :rt',
    ExpressionAttributeValues: { ':v': true, ':rt': resetToken },
  }));

  return { success: true, resetToken };
}

// ── Validate reset token ──────────────────────────────────────────
/**
 * Called by the password reset step to confirm the token is valid
 * before updating the password. Deletes the OTP item after validation
 * so the token can only be used once.
 *
 * @param {string} email
 * @param {string} resetToken
 * @returns {boolean}
 */
async function validateResetToken(email, resetToken) {
  const { Item: data } = await dynamo.send(new GetCommand({
    TableName: OTP_TABLE,
    Key: { email },
  }));

  if (!data) return false;

  // Must be verified and token must match and not expired
  if (!data.verified)                 return false;
  if (data.resetToken !== resetToken) return false;
  if (Date.now() > data.expiresAt) {
    await dynamo.send(new DeleteCommand({ TableName: OTP_TABLE, Key: { email } }));
    return false;
  }

  // Delete the item — token is single-use
  await dynamo.send(new DeleteCommand({ TableName: OTP_TABLE, Key: { email } }));
  return true;
}

module.exports = { storeOTP, verifyOTP, validateResetToken };
