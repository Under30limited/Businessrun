/**
 * utils/sanitise.js
 *
 * Strips any fields from a request body that are not in the
 * allowed list. Prevents clients from injecting extra fields
 * (e.g. `status`, `createdAt`, `uid`) that could manipulate
 * database records in unintended ways.
 *
 * Usage:
 *   const { sanitise } = require('../utils/sanitise');
 *
 *   const clean = sanitise(req.body, [
 *     'fullName', 'businessName', 'email'
 *   ]);
 *   // clean only contains the listed fields that were present
 *
 * Also exports a `requireFields` helper that throws an ApiError
 * if any required field is missing or empty.
 *
 *   requireFields(req.body, ['email', 'password']);
 *   // throws ApiError(400) if either is missing
 */

'use strict';

const ApiError = require('./ApiError');

/**
 * Returns a new object containing only the allowed fields.
 * Fields with undefined or null values are included — filtering
 * those is the caller's responsibility or Firestore's
 * ignoreUndefinedProperties setting handles it.
 *
 * @param {Object} body        The raw request body
 * @param {string[]} allowed   Field names to keep
 * @returns {Object}
 */
function sanitise(body, allowed) {
  if (!body || typeof body !== 'object') return {};

  return allowed.reduce((acc, field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      acc[field] = body[field];
    }
    return acc;
  }, {});
}

/**
 * Throws ApiError(400) if any of the required fields are missing
 * from the body, empty strings, or null/undefined.
 *
 * @param {Object}   body      The raw request body
 * @param {string[]} fields    Required field names
 */
function requireFields(body, fields) {
  if (!body || typeof body !== 'object') {
    throw ApiError.badRequest('Request body is missing or malformed.');
  }

  const missing = fields.filter(
    (f) => body[f] === undefined || body[f] === null || body[f] === ''
  );

  if (missing.length > 0) {
    throw ApiError.badRequest(
      `Missing required field${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`
    );
  }
}

/**
 * Validates an email address format.
 * Lightweight — not RFC-complete, but catches obvious mistakes.
 *
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return typeof email === 'string' && /\S+@\S+\.\S+/.test(email.trim());
}

module.exports = { sanitise, requireFields, isValidEmail };
