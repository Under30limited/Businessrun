/**
 * controllers/advisor.controller.js
 *
 * Handles the Strategic AI Advisor chat.
 * Proxies the request to Gemini via gemini.service.
 *
 * ── PUBLIC WIDGET vs DASHBOARD TAB ──────────────────────────────────
 * This one endpoint serves two very different callers:
 *   1. The public homepage/marketing AI Advisor widget — generic,
 *      anonymous-friendly, must NEVER see private business data.
 *   2. The logged-in dashboard's Advisor tab — grounded in the
 *      business's real CFO/inventory/sales/day-log data.
 *
 * The only reliable signal for which one a request is coming from is
 * an explicit `context: 'dashboard'` flag the client sends — NOT
 * simply whether a session cookie happens to be attached. A session
 * cookie is domain-wide, not page-restricted: someone who is still
 * logged in but just browsing the public homepage would otherwise
 * have their real data silently injected into what's supposed to be
 * a generic tool. So this is fail-closed: real data is fetched ONLY
 * when `context === 'dashboard'` is explicitly present. Anything else
 * — including the field being absent entirely, e.g. an older client
 * that hasn't been updated yet — is treated as public/generic.
 *
 * Dashboard requests are additionally permission-checked: a team
 * member needs 'advisor' explicitly granted (live-checked against the
 * membership table, same as every other requireFeature check, so a
 * revoke takes effect immediately rather than waiting for the JWT to
 * expire). Owners always have access. The public path has no
 * permission check at all — it's open to everyone, logged in or not,
 * because it never touches business data regardless.
 *
 * ── How business data context works (dashboard path only) ───────────
 * Instead of sending the full CFO/Inventory/Sales arrays with every
 * single chat message (which bloats the payload and can trip
 * "request entity too large"), the server fetches this data itself
 * from DynamoDB and injects ONE compact "BASE DATA" message at the
 * start of the conversation history — but only on the FIRST message
 * of a session (i.e. when the client sends an empty history array).
 *
 * On every subsequent message in the same session, the client just
 * sends the normal conversational history (a few KB of text) — no
 * business data payload — keeping every request small regardless of
 * how much inventory/sales/CFO data the business has.
 *
 * Optionally saves conversation history for logged-in dashboard users.
 *
 * Route:
 *   POST /api/advisor
 */

'use strict';

const asyncHandler    = require('../utils/asyncHandler');
const ApiError        = require('../utils/ApiError');
const { sanitise, requireFields } = require('../utils/sanitise');
const geminiService   = require('../services/gemini.service');
const firebaseService = require('../services/db.service');

// ── POST /api/advisor ─────────────────────────────────────────────
const chat = asyncHandler(async (req, res) => {
  const body = sanitise(req.body, [
    'message', 'history', 'sessionId', 'language', 'profile', 'context',
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

  // ── Dashboard vs public context — fail-closed ────────────────────
  // See file header. Only 'dashboard' (exact match) unlocks anything
  // below — everything else behaves exactly like the public widget.
  const isDashboardContext = body.context === 'dashboard';

  if (isDashboardContext) {
    if (!req.user) {
      throw ApiError.unauthorized('Please log in to use the dashboard AI Advisor.');
    }

    // Team members need 'advisor' explicitly granted. Live-checked
    // against the membership table (not just the JWT) so a revoke
    // takes effect on this exact next request.
    if (req.user.role === 'member') {
      const membership = await firebaseService.getMembership(req.user.identityUid, req.user.businessUid);
      const permitted =
        membership &&
        membership.status === 'active' &&
        (membership.permissions || []).includes('advisor');

      if (!permitted) {
        throw ApiError.forbidden("You don't have access to the AI Advisor. Ask the business owner to grant it.");
      }
    }
    // Owners always pass — no DB call needed.
  }

  // ── Business data context — dashboard-only, always fetched server-side ──
  // Fetching from DynamoDB directly (rather than trusting any client-sent
  // data) is both more secure and guarantees the numbers are accurate and
  // current. This block is skipped ENTIRELY for the public path — real
  // data never reaches that response, regardless of req.user.
  let cfoEntries = {};
  let inventory  = [];
  let sales      = [];
  let dayLog     = [];

  // Only fetch business data (CFO, inventory, sales, dayLog) for an
  // authenticated dashboard request, on a brand-new session. On
  // follow-up turns the model already has all data anchored in its
  // conversation history — skipping these reads keeps every
  // subsequent message fast regardless of data volume.
  if (isDashboardContext && req.user && isNewSession) {
    try {
      const uid = req.user.uid;
      const [cfoData, invData, salesData, dayLogData] = await Promise.all([
        firebaseService.getAllCFOEntries(uid),
        firebaseService.getInventoryItems(uid),
        firebaseService.getSales(uid),
        firebaseService.getDayLogForAI(uid),
      ]);
      cfoEntries = cfoData    || {};
      inventory  = invData    || [];
      sales      = salesData  || [];
      dayLog     = dayLogData || [];
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
      dayLog,
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

  // Optionally persist the conversation — dashboard sessions only.
  // The public widget has no reason to persist anything tied to a uid.
  if (isDashboardContext && req.user && body.sessionId) {
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
