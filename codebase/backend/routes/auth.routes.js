/**
 * routes/auth.routes.js
 *
 * POST /api/auth/login            → Verify credentials, issue session
 *                                    (or a business-picker response if
 *                                    the identity has multiple businesses)
 * POST /api/auth/select-business  → Finish login after picking a business
 * POST /api/auth/select-space     → Finish login after picking a space
 *                                    (only used when a personal space was
 *                                    part of the choice set — see
 *                                    controllers/auth.controller.js)
 * POST /api/auth/switch-business  → Swap the active business for an
 *                                    already logged-in session
 * POST /api/auth/logout           → Clear the JWT cookie (server-side)
 * GET  /api/auth/me               → Validate cookie, return profile +
 *                                    available businesses (used on app load)
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const controller    = require('../controllers/auth.controller');
const otpController = require('../controllers/otp.controller');
const { protect }               = require('../middleware/auth');
const { authLimiter, otpLimiter, dataLimiter } = require('../middleware/rateLimiter');
const validate   = require('../middleware/validate');

const loginSchema = {
  email:    { required: true, type: 'email' },
  password: { required: true, type: 'string', min: 1 },
};

// Email existence check — used during GYB signup Step 1
// dataLimiter used (not authLimiter) — less strict, not a brute force target
router.post('/check-email',
  dataLimiter,
  controller.checkEmail
);

// Login — rate limited to prevent brute force
router.post('/login',
  authLimiter,
  validate(loginSchema),
  controller.login
);

// Multi-business login step 2 — finish logging in after picking a
// business. Rate limited like login itself (guessing preAuthTokens
// or businessUids is the same class of attack).
router.post('/select-business',
  authLimiter,
  controller.selectBusiness
);

// Generalized counterpart — only reachable when the login picker
// included a personal space. Same rate-limit reasoning as above.
router.post('/select-space',
  authLimiter,
  controller.selectSpace
);

// Switch which business an ALREADY logged-in session is scoped to.
// Requires a valid session — this is not a login endpoint.
router.post('/switch-business',
  protect,
  dataLimiter,
  controller.switchBusiness
);

// Logout — no auth required (clearing a missing cookie is harmless)
// Rate limit still applied to prevent log-flooding
router.post('/logout',
  authLimiter,
  controller.logout
);

// Session restore — called on every app load by AuthContext
// protect middleware reads the cookie and verifies the JWT
router.get('/me',
  protect,
  controller.getMe
);


// ── OTP Password Reset ────────────────────────────────────────────
// No auth required — user is locked out of their account
router.post('/otp/request', otpLimiter, otpController.requestOTP);
router.post('/otp/verify',  otpLimiter, otpController.verifyOTPCode);
router.post('/otp/reset',   otpLimiter, otpController.resetPassword);

module.exports = router;
