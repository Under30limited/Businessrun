/**
 * controllers/personalAdvisor.controller.js
 *
 * The conversational Wealth Advisor — mirrors controllers/advisor.
 * controller.js's structure, simplified in the ways Personal Wealth
 * OS is genuinely simpler than the business advisor:
 *   - No public/dashboard dual context — there is no public marketing
 *     widget for Personal Wealth OS, so every request here is already
 *     authenticated (protect + requirePersonalSpace), no optionalAuth
 *     dance needed.
 *   - No daily question limit, no memory-day pruning — Personal
 *     Wealth OS has no billing tiers yet (see the build discussion).
 *     One continuous, unlimited thread per space.
 *
 * Routes:
 *   POST   /api/personal/advisor          — send a message, get a reply
 *   GET    /api/personal/advisor/history  — load the persisted thread
 *   DELETE /api/personal/advisor/history  — clear the persisted thread
 */

'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError      = require('../utils/ApiError');
const { sanitise, requireFields } = require('../utils/sanitise');
const personalService     = require('../services/personal.service');
const wealthAdvisorService = require('../services/wealthAdvisor.service');
const netWorthController   = require('./personalNetWorth.controller'); // reuses computeTotals/makeConverter — see that file's exports comment

// ── POST /api/personal/advisor ──────────────────────────────────────
const chat = asyncHandler(async (req, res) => {
  const body = sanitise(req.body, ['message', 'history', 'refreshContext']);
  requireFields(body, ['message']);

  if (typeof body.message !== 'string' || !body.message.trim()) {
    throw ApiError.badRequest('Message cannot be empty.');
  }
  if (body.message.length > 2000) {
    throw ApiError.badRequest('Message is too long. Maximum 2000 characters.');
  }

  let history = Array.isArray(body.history) ? body.history : [];
  if (history.length > 40) history = history.slice(-40);

  const personalUid = req.user.personalUid;
  const shouldRefreshContext = body.refreshContext === true;

  // ── Profile — always fetched fresh, never trusted from the client ──
  const space = await personalService.getPersonalSpace(personalUid);

  // ── Financial data — only on a context refresh (first message of a
  // fresh browser session), same reasoning as the business advisor:
  // on follow-up turns the model already has everything anchored in
  // its own conversation history, so skip the reads for speed.
  let dataSummaryInput = {};
  if (shouldRefreshContext) {
    try {
      const [accounts, incomeStreams, expenses, assets, debts, goals, dayLog] = await Promise.all([
        personalService.getAccounts(personalUid),
        personalService.getIncomeStreams(personalUid),
        personalService.getExpenses(personalUid),
        personalService.getAssets(personalUid),
        personalService.getDebts(personalUid),
        personalService.getGoals(personalUid),
        personalService.getDayLogEntries(personalUid),
      ]);

      // Reuse the SAME net worth math the Net Worth tab shows, in NGN
      // (the canonical currency) — so the Advisor never states a
      // figure that could disagree with what the person sees on
      // screen. Non-fatal if this fails — the rest of the data still
      // makes the Advisor useful.
      let netWorthTotals = null;
      try {
        const convert = await netWorthController.makeConverter();
        netWorthTotals = await netWorthController.computeTotals(personalUid, convert, 'NGN');
        netWorthTotals.currency = 'NGN';
      } catch (err) {
        console.error('[PersonalAdvisor] Failed to compute net worth for context:', err.message);
      }

      dataSummaryInput = { accounts, incomeStreams, expenses, assets, debts, goals, dayLog, netWorthTotals };
    } catch (err) {
      console.error('[PersonalAdvisor] Failed to load financial data context:', err.message);
    }
  }

  let result;
  try {
    result = await wealthAdvisorService.getWealthAdvisorReply(body.message.trim(), history, {
      profile: {
        fullName: space?.fullName,
        nickname: space?.nickname,
        primaryIncomeSource: space?.primaryIncomeSource,
        monthlyIncomeBracket: space?.monthlyIncomeBracket,
        biggestFinancialHeadache: space?.biggestFinancialHeadache,
      },
      dataSummaryInput,
      injectBaseData: shouldRefreshContext,
    });
  } catch (err) {
    if (err.statusCode === 503) {
      return res.json({ text: null, advisorDown: true });
    }
    throw err;
  }

  // Persist — re-fetch fresh rather than trust the client's
  // (possibly-truncated) history, same reasoning as the business
  // advisor's persistence step.
  const now = new Date().toISOString();
  personalService.getPersonalAdvisorHistory(personalUid)
    .then((existing) => {
      const updated = [
        ...existing,
        { role: 'user',      content: body.message.trim(), timestamp: now },
        { role: 'assistant', content: result.text,          timestamp: now },
      ];
      return personalService.appendPersonalAdvisorMessages(personalUid, updated);
    })
    .catch((err) => console.error('[PersonalAdvisor] Failed to save session:', err.message));

  res.json({ text: result.text });
});

// ── GET /api/personal/advisor/history ───────────────────────────────
const getHistory = asyncHandler(async (req, res) => {
  const messages = await personalService.getPersonalAdvisorHistory(req.user.personalUid);
  res.json({ success: true, messages });
});

// ── DELETE /api/personal/advisor/history ────────────────────────────
const clearHistory = asyncHandler(async (req, res) => {
  await personalService.clearPersonalAdvisorHistory(req.user.personalUid);
  res.json({ success: true });
});

module.exports = { chat, getHistory, clearHistory };
