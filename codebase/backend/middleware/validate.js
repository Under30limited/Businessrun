/**
 * middleware/validate.js
 *
 * Middleware factory that validates request bodies against a schema.
 * Keeps validation logic out of controllers — controllers should only
 * contain business logic, not input checking.
 *
 * Schema format:
 *   {
 *     fieldName: {
 *       required: boolean,
 *       type:     'string' | 'number' | 'boolean' | 'email',
 *       min:      number,   // min length for strings, min value for numbers
 *       max:      number,   // max length for strings, max value for numbers
 *       enum:     string[], // value must be one of these
 *     }
 *   }
 *
 * Usage in a route file:
 *
 *   const validate  = require('../middleware/validate');
 *
 *   const loginSchema = {
 *     email:    { required: true, type: 'email' },
 *     password: { required: true, type: 'string', min: 6 },
 *   };
 *
 *   router.post('/login', validate(loginSchema), asyncHandler(login));
 *
 * If validation fails, a 400 ApiError is thrown listing all failing
 * fields — the errorHandler converts it to a JSON response.
 */

'use strict';

const ApiError = require('../utils/ApiError');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(schema) {
  return (req, res, next) => {
    const body   = req.body || {};
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = body[field];
      const empty = value === undefined || value === null || value === '';

      // ── Required check ───────────────────────────────────────
      if (rules.required && empty) {
        errors.push(`"${field}" is required`);
        continue; // skip further checks for this field
      }

      // Skip optional fields that are not present
      if (empty) continue;

      // ── Type checks ──────────────────────────────────────────
      if (rules.type === 'string' && typeof value !== 'string') {
        errors.push(`"${field}" must be a string`);
        continue;
      }

      if (rules.type === 'number' && typeof value !== 'number') {
        errors.push(`"${field}" must be a number`);
        continue;
      }

      if (rules.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`"${field}" must be a boolean`);
        continue;
      }

      if (rules.type === 'email') {
        if (typeof value !== 'string' || !EMAIL_REGEX.test(value.trim())) {
          errors.push(`"${field}" must be a valid email address`);
          continue;
        }
      }

      // ── Min / max ────────────────────────────────────────────
      if (rules.type === 'string' || rules.type === 'email') {
        if (rules.min !== undefined && value.trim().length < rules.min) {
          errors.push(`"${field}" must be at least ${rules.min} characters`);
        }
        if (rules.max !== undefined && value.trim().length > rules.max) {
          errors.push(`"${field}" must be at most ${rules.max} characters`);
        }
      }

      if (rules.type === 'number') {
        if (rules.min !== undefined && value < rules.min) {
          errors.push(`"${field}" must be at least ${rules.min}`);
        }
        if (rules.max !== undefined && value > rules.max) {
          errors.push(`"${field}" must be at most ${rules.max}`);
        }
      }

      // ── Enum ─────────────────────────────────────────────────
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`"${field}" must be one of: ${rules.enum.join(', ')}`);
      }
    }

    if (errors.length > 0) {
      return next(
        ApiError.badRequest(
          `Validation failed: ${errors.join('; ')}`
        )
      );
    }

    next();
  };
}

module.exports = validate;
