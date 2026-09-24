/**
 * utils/asyncHandler.js
 *
 * Wraps an async Express route handler so that any thrown error or
 * rejected promise is automatically forwarded to next(error) and
 * caught by the global errorHandler middleware.
 *
 * Without this, an uncaught promise rejection inside a route handler
 * would crash the server in older Node versions, or silently hang
 * the request in newer ones.
 *
 * Usage — instead of:
 *
 *   router.post('/example', async (req, res, next) => {
 *     try {
 *       const data = await someAsyncOperation();
 *       res.json(data);
 *     } catch (err) {
 *       next(err);
 *     }
 *   });
 *
 * Write:
 *
 *   const asyncHandler = require('../utils/asyncHandler');
 *
 *   router.post('/example', asyncHandler(async (req, res) => {
 *     const data = await someAsyncOperation();
 *     res.json(data);
 *   }));
 *
 * If someAsyncOperation() throws, asyncHandler catches it and
 * calls next(err) automatically. Controllers stay clean.
 *
 * @param {Function} fn  Async route handler function
 * @returns {Function}   Express middleware function
 */

'use strict';

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
