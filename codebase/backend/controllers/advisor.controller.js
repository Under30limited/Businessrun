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
 * ── PERSISTED HISTORY (dashboard only) ───────────────────────────────
 * One continuous advisor thread per BUSINESS (not per browser tab, not
 * multiple listable sessions) — see services/db.service.js's ADVISOR
 * SESSIONS section. Gated by plan.limits.advisorMemoryDays:
 *   - Zero (0 days):        never read or written at all — the thread
 *                            lives only in the client's React state for
 *                            that browser session, same as before this
 *                            feature existed.
 *   - +1 (30 days):         persisted, pruned to a rolling 30-day
 *                            window on every write (and defensively on
 *                            read too).
 *   - +2 / +3 (unlimited):  persisted, never pruned.
 * The persisted copy is the source of truth for what gets appended to
 * (re-fetched fresh server-side on every message, not trusted from the
 * client's possibly-truncated `history`) — same "never trust the
 * client for business data" posture as the CFO/inventory/sales fetch
 * below.
 *
 * `refreshContext: true` replaces "history.length === 0" as the signal
 * for "this is the first message of a fresh browser session, refresh
 * the BASE DATA snapshot" — necessary because history is no longer
 * reliably empty on a first message (it may hydrate from the persisted
 * thread on mount). The client sends this explicitly on the first
 * message after each page load; the server does not infer it.
 *
 * Routes:
 *   POST   /api/advisor          → send a message, get a reply
 *   GET    /api/advisor/history  → load the persisted thread (dashboard)
 *   DELETE /api/advisor/history  → clear the persisted thread (dashboard)
 */

'use strict';

const asyncHandler    = require('../utils/asyncHandler');
const ApiError        = require('../utils/ApiError');
const { sanitise, requireFields } = require('../utils/sanitise');
const geminiService   = require('../services/gemini.service');
const firebaseService = require('../services/db.service');
const { getEffectivePlan } = require('../services/subscription.service');

/**
 * requireDashboardAccess
 * Auth + 'advisor' permission check for the chat endpoint specifically.
 * This duplicates what middleware/permissions.js's requireFeature('advisor')
 * already does — deliberately: POST /api/advisor is the one route that
 * must ALSO serve anonymous public-widget requests (see file header),
 * so it can't sit behind `protect`/`requireFeature` like a normal
 * dashboard route. GET/DELETE /api/advisor/history have no public
 * equivalent, so they use the standard protect + requireFeature('advisor')
 * middleware stack instead — see routes/advisor.routes.js.
 * Throws on failure. Returns the business's effective plan so the
 * caller doesn't need a second getEffectivePlan round trip.
 */
async function requireDashboardAccess(req) {
  if (!req.user) {
    throw ApiError.unauthorized('Please log in to use the dashboard AI Advisor.');
  }

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

  const { plan } = await getEffectivePlan(req.user.uid);
  return plan;
}

// ── POST /api/advisor ─────────────────────────────────────────────
const chat = asyncHandler(async (req, res) => {
  const body = sanitise(req.body, [
    'message', 'history', 'refreshContext', 'language', 'profile', 'context',
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

  // ── Language ───────────────────────────────────────────────────
  const VALID_LANGUAGES = ['English', 'Yoruba', 'Hausa', 'Igbo', 'Pidgin', 'French', 'Arabic'];
  const language = VALID_LANGUAGES.includes(body.language) ? body.language : 'English';

  // ── Business profile (optional — keeps replies personal) ────────
  const profile = (body.profile && typeof body.profile === 'object') ? body.profile : {};

  // ── Dashboard vs public context — fail-closed ────────────────────
  // See file header. Only 'dashboard' (exact match) unlocks anything
  // below — everything else behaves exactly like the public widget.
  const isDashboardContext = body.context === 'dashboard';

  // Explicit client signal for "refresh the BASE DATA snapshot" — see
  // file header. Only meaningful (and only checked) on the dashboard
  // path; the public widget has no BASE DATA to refresh.
  const shouldRefreshContext = isDashboardContext && body.refreshContext === true;

  // Hoisted so the post-reply increment further down can reuse it
  // without recomputing — set only when a daily limit actually applies.
  let dailyLimitPeriod = null;
  let plan             = null;

  if (isDashboardContext) {
    plan = await requireDashboardAccess(req);

    // ── Daily question limit ────────────────────────────────────────
    // A shared pool per BUSINESS, not per team member — matches how
    // every other limit in the pricing doc (users, inventory items)
    // is framed at the business level. plan.limits.advisorQuestionsPerDay
    // is null for unlimited tiers, in which case this is skipped entirely.
    if (plan.limits.advisorQuestionsPerDay !== null) {
      dailyLimitPeriod = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD', UTC by construction

      const askedToday = await firebaseService.getUsageCount(req.user.uid, 'advisorQuestions', dailyLimitPeriod);
      if (askedToday >= plan.limits.advisorQuestionsPerDay) {
        throw ApiError.forbidden(
          `Daily AI question limit reached (${plan.limits.advisorQuestionsPerDay}/day on ${plan.name}). Upgrade for more, or try again after midnight UTC.`
        );
      }
    }
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

  // Only fetch business data (CFO, inventory, sales, dayLog) when the
  // client has explicitly asked for a context refresh (first message
  // of a fresh browser session). On follow-up turns the model already
  // has all data anchored in its conversation history — skipping these
  // reads keeps every subsequent message fast regardless of data volume.
  if (isDashboardContext && req.user && shouldRefreshContext) {
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
      injectBaseData: shouldRefreshContext,
    });
  } catch (err) {
    // AI unavailable — return advisorDown flag so the frontend
    // shows the friendly "unavailable" card rather than an error
    if (err.statusCode === 503) {
      return res.json({ text: null, advisorDown: true });
    }
    throw err;
  }

  // Count this question against the daily limit — only reached if a
  // limit actually applies (dailyLimitPeriod stays null otherwise) and
  // only after the reply above actually succeeded.
  if (dailyLimitPeriod) {
    firebaseService
      .incrementUsageCounter(req.user.uid, 'advisorQuestions', dailyLimitPeriod)
      .catch((err) =>
        console.error('[Advisor] Failed to increment daily usage counter:', err.message)
      );
  }

  // Persist the conversation — dashboard sessions only, and only for
  // tiers with any memory at all (Zero's advisorMemoryDays === 0 means
  // "never touches storage", not "store then immediately prune to
  // empty" — no DB round trip for those businesses).
  if (isDashboardContext && req.user && plan.limits.advisorMemoryDays !== 0) {
    const uid        = req.user.uid;
    const memoryDays = plan.limits.advisorMemoryDays;
    const now         = new Date().toISOString();

    // Re-fetch the persisted thread fresh rather than trust the
    // client's (possibly 40-turn-truncated) `history` — same
    // reasoning as the business-data fetch above. Fire-and-forget,
    // same as the usage counter increment — a failed save shouldn't
    // hold up or fail the reply the user is already looking at.
    firebaseService.getAdvisorHistory(uid, memoryDays)
      .then((existing) => {
        const updated = [
          ...existing,
          { role: 'user',      content: body.message.trim(), timestamp: now },
          { role: 'assistant', content: result.text,          timestamp: now },
        ];
        return firebaseService.appendAdvisorMessages(uid, updated, memoryDays);
      })
      .catch((err) => console.error('[Advisor] Failed to save session:', err.message));
  }

  res.json({ text: result.text });
});

// ── GET /api/advisor/history ────────────────────────────────────────
// Dashboard-only (protect + requireFeature('advisor') applied at the
// route level — see routes/advisor.routes.js). Loads the business's
// persisted thread so the frontend can hydrate the chat on mount
// instead of starting blank.
const getHistory = asyncHandler(async (req, res) => {
  const { plan } = await getEffectivePlan(req.user.uid);

  // Zero tier never persisted anything — return empty rather than
  // making a DB call that would always come back empty anyway.
  if (plan.limits.advisorMemoryDays === 0) {
    return res.json({ messages: [] });
  }

  const messages = await firebaseService.getAdvisorHistory(req.user.uid, plan.limits.advisorMemoryDays);
  res.json({ messages });
});

// ── DELETE /api/advisor/history ─────────────────────────────────────
// Dashboard-only (protect + requireFeature('advisor') applied at the
// route level). Backs the "Clear chat" button — deletes the business's
// persisted thread. Safe to call on any tier, including Zero (nothing
// to delete, but no error either).
const clearHistory = asyncHandler(async (req, res) => {
  await firebaseService.clearAdvisorHistory(req.user.uid);
  res.json({ success: true });
});

module.exports = { chat, getHistory, clearHistory };
