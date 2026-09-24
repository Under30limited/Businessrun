/**
 * routes/accounting.routes.js
 *
 * POST /api/accounting → AI accounting report generation
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/accounting.controller');
const { accountingLimiter } = require('../middleware/rateLimiter');
const validate   = require('../middleware/validate');

const accountingSchema = {
  activeTool: {
    required: true,
    type:     'string',
    enum:     ['General Ledger', 'Income Statement', 'Balance Sheet', 'Cash Flow'],
  },
};

// Note: transactions array is validated inside the controller
// (array validation is outside the scope of the validate middleware)

router.post('/',
  accountingLimiter,
  validate(accountingSchema),
  controller.generateReport
);

module.exports = router;
