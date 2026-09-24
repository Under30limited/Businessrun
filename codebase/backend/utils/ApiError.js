/**
 * utils/ApiError.js
 *
 * Custom error class that carries an HTTP status code alongside
 * the message. Thrown from controllers and services when something
 * goes wrong in a predictable, handled way.
 *
 * The global errorHandler middleware catches these and formats the
 * response correctly. Unhandled errors (unexpected crashes) are
 * also caught there but return a generic 500.
 *
 * Usage:
 *   throw new ApiError(404, 'User not found');
 *   throw new ApiError(400, 'Email is required');
 *   throw new ApiError(401, 'Invalid credentials');
 *   throw new ApiError(429, 'Too many requests');
 */

'use strict';

class ApiError extends Error {
  /**
   * @param {number} statusCode  HTTP status code (400, 401, 403, 404, 500 etc.)
   * @param {string} message     Human-readable error message sent to the client
   * @param {boolean} isOperational
   *   true  = expected error (bad input, not found, auth failure)
   *           — safe to send message to client
   *   false = unexpected error (bug, infra failure)
   *           — message is replaced with a generic string in production
   */
  constructor(statusCode, message, isOperational = true) {
    super(message);

    this.statusCode    = statusCode;
    this.isOperational = isOperational;
    this.status        = statusCode >= 500 ? 'error' : 'fail';

    // Capture the stack trace, excluding the constructor call itself,
    // so stack traces point to where the error was thrown, not here.
    Error.captureStackTrace(this, this.constructor);
  }

  // ── Static factory helpers for common cases ───────────────────

  static badRequest(message = 'Bad request') {
    return new ApiError(400, message);
  }

  static unauthorized(message = 'Unauthorised') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Not found') {
    return new ApiError(404, message);
  }

  static tooManyRequests(message = 'Too many requests — please slow down') {
    return new ApiError(429, message);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, message, false);
  }
}

module.exports = ApiError;
