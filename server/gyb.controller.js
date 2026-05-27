/**
 * controllers/gyb.controller.js
 *
 * Handles the Grow Your Business onboarding flow.
 * ALL four steps go through POST /api/gyb.
 *
 * Step 1 — creates session doc with identity fields
 * Step 2 — updates session with business pulse fields
 * Step 3 — updates session with matchmaking choice
 * Step 4 — receives hashed password + full profile:
 *           1. Writes complete permanent user doc to Firestore
 *           2. Cleans up temporary session doc
 *           Done. No Firebase Auth involved at signup.
 *           Authentication happens only at login via bcrypt.compare.
 */

'use strict';

const asyncHandler    = require('../utils/asyncHandler');
const ApiError        = require('../utils/ApiError');
const { sanitise, requireFields, isValidEmail } = require('../utils/sanitise');
const firebaseService = require('../services/firebase.service');
const { db, admin }   = require('../config/firebase');
const bcrypt          = require('bcryptjs');
const { signToken, COOKIE_NAME, COOKIE_OPTIONS } = require('../utils/jwt');

const FieldValue = admin.firestore.FieldValue;

const VALID_STAGES    = ['Ideation', 'Launch', 'Scaling', 'Established'];
const VALID_CHANNELS  = ['Social Media', 'Physical Store', 'E-commerce', 'B2B', 'Referrals'];
const VALID_REVENUES  = ['Under ₦500k', '₦500k – ₦2M', '₦2M – ₦10M', 'Over ₦10M'];
const VALID_HEADACHES = [
  'Pricing for Profit',
  'Tracking Cashflow',
  'Accessing Credit/Loans',
  'Managing Staff/Payroll',
];

// ── POST /api/gyb ─────────────────────────────────────────────────
const saveStep = asyncHandler(async (req, res) => {
  const step = parseInt(req.body?.step);

  if (![1, 2, 3, 4].includes(step)) {
    throw ApiError.badRequest('Invalid step. Must be 1, 2, 3, or 4.');
  }

  requireFields(req.body, ['sessionId']);
  const sessionId = req.body.sessionId;

  // ── Step 1 — Identity ─────────────────────────────────────────
  if (step === 1) {
    const body = sanitise(req.body, [
      'fullName', 'businessName', 'email', 'startedAt', 'source',
    ]);
    requireFields(body, ['fullName', 'businessName', 'email']);

    if (!isValidEmail(body.email)) {
      throw ApiError.badRequest('Invalid email address.');
    }

    await firebaseService.createGybSession(sessionId, {
      fullName:     body.fullName.trim(),
      businessName: body.businessName.trim(),
      email:        body.email.toLowerCase().trim(),
      source:       body.source || 'businessrun-gyb',
    });

    return res.json({ success: true, step });
  }

  // ── Step 2 — Business Pulse ───────────────────────────────────
  if (step === 2) {
    const body = sanitise(req.body, [
      'stage', 'salesChannel', 'revenue', 'headache',
    ]);
    requireFields(body, ['stage', 'salesChannel', 'revenue', 'headache']);

    if (!VALID_STAGES.includes(body.stage)) {
      throw ApiError.badRequest(`Invalid stage: "${body.stage}".`);
    }
    // salesChannel may be a comma-separated list of multiple channels
    // (e.g. "Social Media, WhatsApp") — validate each one individually
    const submittedChannels = body.salesChannel
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);

    if (submittedChannels.length === 0) {
      throw ApiError.badRequest('At least one sales channel is required.');
    }

    const invalidChannel = submittedChannels.find(c => !VALID_CHANNELS.includes(c));
    if (invalidChannel) {
      throw ApiError.badRequest(`Invalid sales channel: "${invalidChannel}". Valid options: ${VALID_CHANNELS.join(', ')}.`);
    }
    if (!VALID_REVENUES.includes(body.revenue)) {
      throw ApiError.badRequest(`Invalid revenue bracket: "${body.revenue}".`);
    }
    if (!VALID_HEADACHES.includes(body.headache)) {
      throw ApiError.badRequest(`Invalid headache: "${body.headache}".`);
    }

    await firebaseService.updateGybSession(sessionId, {
      stage:          body.stage,
      salesChannel:   body.salesChannel,
      revenue:        body.revenue,
      headache:       body.headache,
      onboardingStep: 2,
    });

    return res.json({ success: true, step });
  }

  // ── Step 3 — Trust & Matchmaking ─────────────────────────────
  if (step === 3) {
    const body = sanitise(req.body, ['matchmaking', 'completedAt']);
    requireFields(body, ['matchmaking']);

    const validMatchmaking = ['Yes, help me scale', "No, I'll manage on my own"];
    if (!validMatchmaking.includes(body.matchmaking)) {
      throw ApiError.badRequest('Invalid matchmaking response.');
    }

    await firebaseService.updateGybSession(sessionId, {
      matchmaking:    body.matchmaking,
      onboardingStep: 3,
    });

    return res.json({ success: true, step });
  }

  // ── Step 4 — Password + Complete Profile ─────────────────────
  // No Firebase Auth. Just write everything to Firestore and move on.
  // Login verification uses bcrypt.compare against hashedPassword.
  if (step === 4) {
    const body = sanitise(req.body, [
      'email',
      'password',          // plain text — we hash it here on the server
      'fullName',
      'businessName',
      'stage',
      'salesChannel',
      'revenue',
      'headache',
      'matchmaking',
      'profileSavedAt',
      'source',
    ]);

    requireFields(body, ['email', 'password']);

    if (!isValidEmail(body.email)) {
      throw ApiError.badRequest('Invalid email address.');
    }

    if (typeof body.password !== 'string' || body.password.length < 6) {
      throw ApiError.badRequest('Password must be at least 6 characters.');
    }

    // Hash the password server-side — plain text never persisted.
    // saltRounds 12 is the production-grade balance of security vs speed.
    const hashedPassword = await bcrypt.hash(body.password, 12);

    // Check if email already registered this is the line

    // Generate a simple unique ID for this user
    // Using Firestore auto-ID pattern — no Firebase Auth dependency
    const userRef = db.collection('users').doc();
    const uid     = userRef.id;

    // Write the complete user document in one shot
    await userRef.set({
      uid,
      sessionId:      sessionId,
      fullName:       (body.fullName     || '').trim(),
      businessName:   (body.businessName || '').trim(),
      email:          body.email.toLowerCase().trim(),
      stage:          body.stage        || '',
      salesChannel:   body.salesChannel || '',
      revenue:        body.revenue      || '',
      headache:       body.headache     || '',
      matchmaking:    body.matchmaking  || '',
      hashedPassword: hashedPassword,
      source:         body.source       || 'businessrun-gyb',
      onboardingStep: 4,
      completed:      true,
      profileSaved:   true,
      profileSavedAt: body.profileSavedAt || new Date().toISOString(),
      createdAt:      FieldValue.serverTimestamp(),
      updatedAt:      FieldValue.serverTimestamp(),
    });

    console.log(`[GYB] User created: ${uid} (${body.email})`);

    // Issue a JWT cookie immediately after signup so the user is
    // logged in as soon as their account is created — no separate
    // login step required.
    const profileForToken = {
      uid,
      email:        body.email.toLowerCase().trim(),
      fullName:     (body.fullName     || '').trim(),
      businessName: (body.businessName || '').trim(),
      stage:        body.stage        || '',
      salesChannel: body.salesChannel || '',
      revenue:      body.revenue      || '',
      headache:     body.headache     || '',
      matchmaking:  body.matchmaking  || '',
    };
    const token = signToken(profileForToken);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

    // Clean up temporary session doc — fire and forget
    db.collection('users')
      .doc(sessionId)
      .delete()
      .catch(err => console.warn('[GYB] Session cleanup failed:', err.message));

    return res.status(201).json({
      success: true,
      step,
      profile: profileForToken,  // frontend hydrates AuthContext immediately
    });
  }
});

module.exports = { saveStep };
