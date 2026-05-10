/**
 * middleware/errorHandler.js
 *
 * Global Express error handler. Must be registered LAST in index.js
 * after all routes — Express identifies it as an error handler because
 * it has 4 arguments (err, req, res, next).
 *
 * Handles two categories of error:
 *
 *   1. ApiError (operational) — thrown intentionally from controllers.
 *      The status code and message are sent to the client as-is.
 *      Example: 400 "Email is required", 401 "Invalid credentials"
 *
 *   2. Everything else (unexpected) — bugs, Firestore failures, etc.
 *      In production: client gets a generic 500 message, real error
 *      is logged server-side only. In development: full error details
 *      are sent so you can debug quickly.
 *
 * All error responses follow the same shape:
 *   { success: false, message: '...' }
 *   or in development:
 *   { success: false, message: '...', stack: '...' }
 */

'use strict';

const ApiError = require('../utils/ApiError');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const isDev = process.env.NODE_ENV !== 'production';

  // ── Log every error server-side ───────────────────────────────
  // In production you might pipe this to a logging service.
  // For now, stderr is captured by PM2 and available via `pm2 logs`.
  console.error(`[Error] ${req.method} ${req.originalUrl}`, {
    message:    err.message,
    statusCode: err.statusCode ?? 500,
    stack:      isDev ? err.stack : undefined,
  });

  // ── Firebase Auth errors ──────────────────────────────────────
  // Firebase Admin SDK throws errors with a `code` property.
  // Map common ones to clean ApiErrors before responding.
  if (err.code) {
    const firebaseMap = {
      'auth/email-already-exists':    new ApiError(409, 'An account with this email already exists.'),
      'auth/user-not-found':          new ApiError(404, 'No account found with this email.'),
      'auth/wrong-password':          new ApiError(401, 'Invalid email or password.'),
      'auth/invalid-email':           new ApiError(400, 'Invalid email address.'),
      'auth/weak-password':           new ApiError(400, 'Password must be at least 6 characters.'),
      'auth/too-many-requests':       new ApiError(429, 'Too many attempts. Please try again later.'),
      'auth/id-token-expired':        new ApiError(401, 'Session expired. Please log in again.'),
      'auth/argument-error':          new ApiError(400, 'Invalid authentication token.'),
      'auth/invalid-id-token':        new ApiError(401, 'Invalid authentication token.'),
    };

    const mapped = firebaseMap[err.code];
    if (mapped) {
      return res.status(mapped.statusCode).json({
        success: false,
        message: mapped.message,
      });
    }
  }

  // ── Operational ApiError ──────────────────────────────────────
  if (err instanceof ApiError && err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(isDev && { stack: err.stack }),
    });
  }

  // ── Express JSON parse error ──────────────────────────────────
  // Happens when client sends malformed JSON body.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON in request body.',
    });
  }

  // ── CORS error ────────────────────────────────────────────────
  if (err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({
      success: false,
      message: 'Request blocked by CORS policy.',
    });
  }

  // ── Multer errors (file upload) ───────────────────────────────
  // multer throws errors with a `code` property distinct from Firebase.
  // LIMIT_FILE_SIZE: file exceeded the maxSize set in multer config (5MB).
  // LIMIT_UNEXPECTED_FILE: wrong field name used in the FormData upload.
  // Without this block these fall through to the generic 500 handler and
  // the client sees "Something went wrong" instead of a useful message.
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'Image is too large. Maximum file size is 5MB. Please compress or resize the image and try again.',
    });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Unexpected file field. Use the "image" field name for uploads.',
    });
  }

  // ── Unexpected error ──────────────────────────────────────────
  // Never expose internal error details to the client in production.
  return res.status(500).json({
    success: false,
    message: isDev ? err.message : 'Something went wrong. Please try again.',
    ...(isDev && { stack: err.stack }),
  });
}

module.exports = errorHandler;
