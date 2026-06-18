/**
 * controllers/advisor.controller.js
 *
 * Handles the Strategic AI Advisor chat.
 * Proxies the request to Gemini via gemini.service.
 *
 * ── How business data context works ─────────────────────────────
 * Instead of sending the full CFO/Inventory/Sales arrays with every
 * single chat message (which bloats the payload and can trip
 * "request entity too large"), the server fetches this data itself
 * from Firestore and injects ONE compact "BASE DATA" message at the
 * start of the conversation history — but only on the FIRST message
 * of a session (i.e. when the client sends an empty history array).
 *
 * That base message is explicitly labeled so the model treats it as
 * the permanent, authoritative source of truth for the rest of the
 * session: it must reference these exact figures (inventory prices,
 * quantities, CFO entries, sales) rather than inventing or guessing
 * numbers, and should keep referring back to it on later turns even
 * though it isn't re-sent.
 *
 * On every subsequent message in the same session, the client just
 * sends the normal conversational history (a few KB of text) — no
 * business data payload — keeping every request small regardless of
 * how much inventory/sales/CFO data the business has.
 *
 * Optionally saves conversation history to Firestore for logged-in users.
 *
 * Route:
 *   POST /api/advisor
 */

'use strict';

const asyncHandler    = require('../utils/asyncHandler');
const ApiError        = require('../utils/ApiError');
const { sanitise, requireFields } = require('../utils/sanitise');
const geminiService   = require('../services/gemini.service');
const firebaseService = require('../services/firebase.service');

// ── POST /api/advisor ─────────────────────────────────────────────
const chat = asyncHandler(async (req, res) => {
  const body = sanitise(req.body, [
    'message', 'history', 'sessionId', 'language', 'profile',
  ]);
  requireFields(body, ['message']);

  if (typeof body.message !== 'string' || !body.message.trim()) {
    throw ApiError.badRequest('Message cannot be empty.');
  }
  if (body.message.length > 2000) {
    throw ApiError.badRequest('Message is too long. Maximum 2000 characters.');
  }

  // Validate + cap history — only the last 40 conversational turns are kept.
  // Note: history here is plain conversational text only. Business data is
  // never sent by the client — see the base-data injection below.
  let history = Array.isArray(body.history) ? body.history : [];
  if (history.length > 40) history = history.slice(-40);

  const isNewSession = history.length === 0;

  // ── Language ───────────────────────────────────────────────────
  const VALID_LANGUAGES = ['English', 'Yoruba', 'Hausa', 'Igbo', 'Pidgin', 'French', 'Arabic'];
  const language = VALID_LANGUAGES.includes(body.language) ? body.language : 'English';

  // ── Business profile (optional — keeps replies personal) ────────
  const profile = (body.profile && typeof body.profile === 'object') ? body.profile : {};

  // ── Business data context — always fetched server-side ──────────
  // Fetching from Firestore directly (rather than trusting client-sent
  // arrays) is both more secure and guarantees the numbers are accurate
  // and current, regardless of what the client's local state has cached.
  let cfoEntries = {};
  let inventory  = [];
  let sales      = [];

  // Only fetch business data (CFO, inventory, sales) when this is a new
  // session. On follow-up turns the model already has the BASE BUSINESS
  // DATA message anchored earlier in its conversation history, so we
  // skip these Firestore reads entirely — this matters a lot for
  // businesses with large inventories (hundreds/thousands of SKUs),
  // where re-fetching everything on every single chat message would be
  // wasteful and slow.
  if (req.user && isNewSession) {
    try {
      const uid = req.user.uid;
      const [cfoData, invData, salesData] = await Promise.all([
        firebaseService.getAllCFOEntries(uid),
        firebaseService.getInventoryItems(uid),
        firebaseService.getSales(uid),
      ]);
      cfoEntries = cfoData || {};
      inventory  = invData  || [];
      sales      = salesData || [];
    } catch (err) {
      // Non-fatal — advisor can still respond without business data
      console.error('[Advisor] Failed to load business data context:', err.message);
    }
  }

  let result;
  try {
    result = await geminiService.getAdvisorReply(body.message.trim(), history, {
      language,
      profile,
      cfoEntries,
      inventory,
      sales,
      // Only inject the BASE DATA message on the first turn of a session.
      // On later turns the model is expected to recall it from the
      // conversation history that was already sent back to it.
      injectBaseData: isNewSession,
    });
  } catch (err) {
    // AI unavailable — return advisorDown flag so the frontend
    // shows the friendly "unavailable" card rather than an error
    if (err.statusCode === 503) {
      return res.json({ text: null, advisorDown: true });
    }
    throw err;
  }

  // Optionally persist the conversation for logged-in users
  if (req.user && body.sessionId) {
    const updatedMessages = [
      ...history,
      { role: 'user',      content: body.message.trim() },
      { role: 'assistant', content: result.text          },
    ];

    firebaseService
      .upsertAdvisorSession(body.sessionId, req.user.uid, updatedMessages)
      .catch((err) =>
        console.error('[Advisor] Failed to save session:', err.message)
      );
  }

  res.json({ text: result.text });
});

module.exports = { chat };
