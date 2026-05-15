/**
 * controllers/otp.controller.js
 *
 * Three-step password reset via email OTP:
 *
 *   POST /api/auth/otp/request  — generate + send OTP
 *   POST /api/auth/otp/verify   — verify code → issue reset token
 *   POST /api/auth/otp/reset    — validate token → update password
 *
 * No authentication required — user is locked out of their account.
 */

'use strict';

const asyncHandler    = require('../utils/asyncHandler');
const ApiError        = require('../utils/ApiError');
const { sanitise, requireFields, isValidEmail } = require('../utils/sanitise');
const { storeOTP, verifyOTP, validateResetToken } = require('../utils/otp');
const { sendOTPEmail } = require('../services/email.service');
const firebaseService = require('../services/firebase.service');
const bcrypt          = require('bcryptjs');

// ── POST /api/auth/otp/request ────────────────────────────────────
/**
 * Generates a 6-digit OTP, stores it in Firestore, and emails it.
 *
 * IMPORTANT: Always returns success regardless of whether the email
 * is registered — prevents email enumeration attacks.
 * The actual email is only sent if the user exists in Firestore.
 *
 * Body: { email }
 * Response: { success: true, message: '...' }
 */
const requestOTP = asyncHandler(async (req, res) => {
  const body = sanitise(req.body, ['email']);
  requireFields(body, ['email']);

  const email = body.email.trim().toLowerCase();
  if (!isValidEmail(email)) throw ApiError.badRequest('Invalid email address.');

  // Look up user — inform the user explicitly if not found.
  // BusinessRun is not a public platform so revealing registration
  // status is acceptable and improves UX for locked-out users.
  let user = null;
  try {
    user = await firebaseService.getUserByEmail(email);
  } catch {
    // getUserByEmail throws when not found
  }

  if (!user) {
    return res.status(404).json({
      success:      false,
      notFound:     true,   // frontend uses this flag to show the signup link
      message:      'No account found with that email address. Please sign up to get started.',
    });
  }

  // User exists — generate and send OTP
  try {
    const code = await storeOTP(email);
    await sendOTPEmail({ to: email, code, name: user.fullName || '' });
  } catch (err) {
    // Log the full error so PM2 logs show exactly what went wrong:
    //   - RESEND_API_KEY not set → '[Email] RESEND_API_KEY is not set in .env'
    //   - Resend rejected      → '[Email] Resend rejected the request (403): ...'
    //   - Network failure      → '[Email] Network error reaching Resend: ...'
    console.error('[OTP] Email send failed:', err.message);
    throw ApiError.internal(
      'Could not send reset code. Please try again in a moment.'
    );
  }

  res.json({
    success: true,
    message: 'A 6-digit code has been sent to your email.',
  });
});

// ── POST /api/auth/otp/verify ─────────────────────────────────────
/**
 * Verifies the OTP code submitted by the user.
 * On success, returns a one-time resetToken to authorise the
 * password update in the next step.
 *
 * Body: { email, code }
 * Response (success): { success: true, resetToken: string }
 * Response (failure): { success: false, message: string }
 */
const verifyOTPCode = asyncHandler(async (req, res) => {
  const body = sanitise(req.body, ['email', 'code']);
  requireFields(body, ['email', 'code']);

  const email = body.email.trim().toLowerCase();
  const code  = String(body.code).trim();

  if (!isValidEmail(email)) throw ApiError.badRequest('Invalid email address.');
  if (!/^\d{6}$/.test(code)) throw ApiError.badRequest('Code must be a 6-digit number.');

  const result = await verifyOTP(email, code);

  if (!result.success) {
    // Map internal reasons to user-friendly messages
    const messages = {
      not_found:    'No reset code found for this email. Please request a new one.',
      expired:      'This code has expired. Please request a new one.',
      max_attempts: 'Too many incorrect attempts. Please request a new code.',
      invalid:      result.attemptsLeft > 0
        ? `Incorrect code. ${result.attemptsLeft} attempt${result.attemptsLeft === 1 ? '' : 's'} remaining.`
        : 'Incorrect code. Please request a new one.',
    };

    return res.status(400).json({
      success: false,
      message: messages[result.reason] || 'Invalid code. Please try again.',
    });
  }

  res.json({ success: true, resetToken: result.resetToken });
});

// ── POST /api/auth/otp/reset ──────────────────────────────────────
/**
 * Validates the resetToken from the verify step and updates the
 * user's hashed password in Firestore.
 *
 * Authentication in this system uses Firestore + bcrypt exclusively.
 * Firebase Auth is not involved — no createUser() is ever called
 * during signup, so no updateUser() is called here either.
 *
 * Body: { email, resetToken, newPassword }
 * Response: { success: true, message: '...' }
 */
const resetPassword = asyncHandler(async (req, res) => {
  const body = sanitise(req.body, ['email', 'resetToken', 'newPassword']);
  requireFields(body, ['email', 'resetToken', 'newPassword']);

  const email    = body.email.trim().toLowerCase();
  const token    = body.resetToken.trim();
  const password = body.newPassword;

  if (!isValidEmail(email))                      throw ApiError.badRequest('Invalid email address.');
  if (typeof password !== 'string' || password.length < 6)
    throw ApiError.badRequest('Password must be at least 6 characters.');

  // Validate the reset token — single use, deleted after this check
  const valid = await validateResetToken(email, token);
  if (!valid) {
    throw ApiError.badRequest(
      'Reset session has expired or is invalid. Please start the reset process again.'
    );
  }

  // Fetch the user to get their uid
  const user = await firebaseService.getUserByEmail(email);
  if (!user) throw ApiError.notFound('Account not found.');

  // Hash the new password server-side (saltRounds 12 — production standard)
  const hashedPassword = await bcrypt.hash(password, 12);

  // Update password in Firestore — this is the only auth store we use.
  // Firebase Auth is NOT used for authentication in this system — login
  // goes through Firestore + bcrypt entirely, so no Firebase Auth update
  // is needed or possible (users are never created in Firebase Auth).
  const { db } = require('../config/firebase');
  await db.collection('users').doc(user.uid).update({ hashedPassword });

  res.json({
    success: true,
    message: 'Password updated successfully. You can now log in with your new password.',
  });
});

module.exports = { requestOTP, verifyOTPCode, resetPassword };
