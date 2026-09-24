/**
 * routes/personalAccounts.routes.js
 *
 *   GET    /api/personal/accounts       — list
 *   POST   /api/personal/accounts       — create
 *   PATCH  /api/personal/accounts/:id   — update
 *   DELETE /api/personal/accounts/:id   — delete
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/personalAccounts.controller');
const { protect } = require('../middleware/auth');
const { requirePersonalSpace } = require('../middleware/requirePersonalSpace');
const { dashboardLimiter } = require('../middleware/rateLimiter');

router.use(dashboardLimiter, protect, requirePersonalSpace);

router.get('/',      controller.getAccounts);
router.post('/',     controller.createAccount);
router.patch('/:id', controller.updateAccount);
router.delete('/:id', controller.deleteAccount);

module.exports = router;
