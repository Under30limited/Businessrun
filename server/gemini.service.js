/**
 * services/gemini.service.js
 *
 * All outbound calls to the Gemini 2.0 Flash API.
 * Controllers never call Gemini directly — they call these functions.
 *
 * Every function follows the same pattern:
 *   1. Build a prompt specific to the feature
 *   2. POST to the Gemini REST endpoint
 *   3. Parse and validate the response
 *   4. Return clean data or throw an ApiError
 *
 * Why the REST API and not the @google/genai SDK?
 *   The SDK uses ESM and requires extra bundler config on Node.
 *   The REST API works with plain node-fetch, has no setup, and
 *   behaves identically. Simpler is better in production.
 *
 * Exported functions:
 *   getAdvisorReply(message, history)  → { text }
 *   getAccountingReport(transactions, activeTool) → { result }
 *   getRoadmapInsight(profile)         → { insight }
 */

'use strict';

const ApiError = require('../utils/ApiError');

// Model name is read from env so you can swap models without a redeploy.
// Falls back to gemini-2.0-flash — current, fast, and fully supports the
// contents / systemInstruction / generationConfig schema used throughout.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ── Shared Gemini fetch helper ────────────────────────────────────
/**
 * Makes a POST request to the Gemini API and returns the raw
 * text from the first candidate's first part.
 *
 * @param {Object[]} contents          Gemini `contents` array
 * @param {string}   systemInstruction Plain text system prompt
 * @param {Object}   generationConfig  Optional generation config overrides
 * @returns {Promise<string>}          Raw text from Gemini
 * @throws {ApiError}                  If Gemini is unreachable or returns an error
 */
async function callGemini(contents, systemInstruction, generationConfig = {}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw ApiError.internal(
      '[Gemini] GEMINI_API_KEY is not set in environment variables.'
    );
  }

  let response;
  try {
    // Node 18+ ships a stable built-in fetch — no external dependency needed.
    // Using node-fetch via dynamic import caused body-serialisation issues on
    // Node 22 that produced the "Unknown name 'contents'" 400 from Gemini.
    response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig:  {
          maxOutputTokens: 1024,
          ...generationConfig,
        },
      }),
    });
  } catch (networkErr) {
    // DNS failure, timeout, Gemini unreachable
    console.error('[Gemini] Network error:', networkErr.message);
    throw new ApiError(503, 'AI service is temporarily unavailable.', true);
  }

  // Parse raw text first — Gemini occasionally returns HTML error pages
  // on quota/auth errors rather than JSON
  const rawText = await response.text();

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    console.error('[Gemini] Non-JSON response:', rawText.slice(0, 300));
    throw new ApiError(503, 'AI service returned an unexpected response.', true);
  }

  // Gemini structured error (quota exceeded, invalid key, etc.)
  if (data.error) {
    console.error('[Gemini] API error:', data.error);
    throw new ApiError(503, 'AI service is temporarily unavailable.', true);
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text || !text.trim()) {
    throw new ApiError(503, 'AI service returned an empty response.', true);
  }

  return text;
}

// ── Strip any HTML tags Gemini occasionally returns ───────────────
function stripHtml(input) {
  return input
    .replace(/<\/p>/gi,      '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi,     '\n')
    .replace(/<\/div>/gi,    '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<strong>(.*?)<\/strong>/gis, '**$1**')
    .replace(/<b>(.*?)<\/b>/gis,           '**$1**')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Clean a JSON response from Gemini ─────────────────────────────
// ── Language instruction helper ──────────────────────────────────
// Appended to every insight prompt so Gemini responds in the
// language the user selected. English is the default fallback.
// Only the insight TEXT fields are translated — JSON keys stay in English
// so parseJsonResponse always works regardless of language.
const SUPPORTED_LANGUAGES = {
  'English':    'Respond in clear, simple English.',
  'Yoruba':     'Respond in Yoruba language. Use natural, conversational Yoruba that a Nigerian business owner would understand. JSON keys must remain in English.',
  'Hausa':      'Respond in Hausa language. Use natural, conversational Hausa that a Nigerian business owner would understand. JSON keys must remain in English.',
  'Igbo':       'Respond in Igbo language. Use natural, conversational Igbo that a Nigerian business owner would understand. JSON keys must remain in English.',
  'Pidgin':     'Respond in Nigerian Pidgin English. Use natural pidgin that feels familiar to a Lagos or Port Harcourt business owner. JSON keys must remain in English.',
  'French':     'Respond in French. JSON keys must remain in English.',
  'Arabic':     'Respond in Arabic. JSON keys must remain in English.',
};

function getLanguageInstruction(language) {
  return SUPPORTED_LANGUAGES[language] || SUPPORTED_LANGUAGES['English'];
}

function parseJsonResponse(raw) {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new ApiError(503, 'AI service returned malformed data.', true);
  }
}

// ─────────────────────────────────────────────────────────────────
// 1. Strategic AI Advisor
// ─────────────────────────────────────────────────────────────────

const ADVISOR_SYSTEM_PROMPT =
  'You are the "TBR Strategic AI Advisor" for BusinessRun, a platform for African founders. ' +
  'Help African business owners register, grow and scale their businesses. ' +
  'Tone: High-agency, professional, actionable. Keep responses concise and practical. ' +
  'Topics: CAC registration, Nigerian tax law, go-to-market strategy, fundraising, ' +
  'fintech, AfCFTA, e-commerce, brand building, pricing, hiring. ' +
  'Always reply in plain text only. Never use HTML tags. ' +
  'You may use markdown such as **bold**, bullet points and line breaks.';

/**
 * getAdvisorReply
 * Called by the AI Advisor chat on the homepage.
 *
 * @param {string}    message   The user's latest message
 * @param {Object[]}  history   Previous messages [{ role, content }]
 * @returns {Promise<{ text: string }>}
 */
async function getAdvisorReply(message, history = []) {
  // Convert chat history into Gemini format
  const contents = [
    ...history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    {
      role: "user",
      parts: [{ text: message }],
    },
  ];

  const rawText = await callGemini({
    contents,
    systemInstruction: {
      parts: [{ text: ADVISOR_SYSTEM_PROMPT }],
    },
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.7,
    },
  });

  // Clean model output (remove accidental HTML)
  const text = stripHtml(rawText)?.trim();

  if (!text) {
    throw new ApiError(
      503,
      "AI service returned an empty response.",
      true
    );
  }

  return { text };
}
// last one
/*async function getAdvisorReply(message, history = []) {
  const contents = [
    ...history.map((m) => ({
      role:  m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ];

  const rawText = await callGemini(
    contents,
    ADVISOR_SYSTEM_PROMPT,
    { maxOutputTokens: 1024 }
  );

  // Strip any HTML the model occasionally includes
  const text = stripHtml(rawText);

  if (!text) {
    throw new ApiError(503, 'AI service returned an empty response.', true);
  }

  return { text };
}*/

// ─────────────────────────────────────────────────────────────────
// 2. Accounting AI Report
// ─────────────────────────────────────────────────────────────────

/**
 * getAccountingReport
 * Called by AccountingTools to generate AI financial analysis.
 *
 * @param {Object[]} transactions  Array of ledger entries
 * @param {string}   activeTool   'General Ledger' | 'Income Statement' | etc.
 * @returns {Promise<{ result: Object }>}
 *   result: { audit: string, totals: Object, insight: string }
 */
async function getAccountingReport(transactions, activeTool) {
  const prompt =
    `You are a professional accountant working with Nigerian SMEs. ` +
    `Analyze this financial data for a ${activeTool} report: ` +
    `${JSON.stringify(transactions)}. ` +
    `1. Audit for errors (negative balances, missing categories, inconsistencies). ` +
    `2. Calculate totals based on standard accounting principles. ` +
    `3. Provide a clear, actionable strategic insight relevant to the Nigerian business context. ` +
    `Output ONLY a valid JSON object with exactly these fields: ` +
    `"audit" (string — errors found, or "No issues found"), ` +
    `"totals" (object with applicable fields from: revenue, expenses, netIncome, assets, liabilities), ` +
    `"insight" (string — 2-3 sentences of actionable business advice). ` +
    `Do not include any text outside the JSON object.`;

  const contents = [{ role: 'user', parts: [{ text: prompt }] }];

  const rawText = await callGemini(
    contents,
    'You are a professional Nigerian business accountant. Always respond in valid JSON only.',
    { maxOutputTokens: 1024, responseMimeType: 'application/json' }
  );

  const result = parseJsonResponse(rawText);
  return { result };
}

// ─────────────────────────────────────────────────────────────────
// 3. Roadmap Insight
// ─────────────────────────────────────────────────────────────────

/**
 * getRoadmapInsight
 * Called after GYB onboarding to generate the personalised dashboard.
 *
 * @param {Object} profile  { businessName, stage, salesChannel, revenue, headache }
 * @returns {Promise<{ insight: Object }>}
 *   insight: {
 *     prioritySignal: string,
 *     sectorFocus:    string,
 *     sectorDetail:   string,
 *     weeklyAction:   string,
 *     headacheAdvice: string,
 *   }
 */
async function getRoadmapInsight({
  businessName,
  stage,
  salesChannel,
  revenue,
  headache,
  language = 'English',
}) {
  const langInstruction = getLanguageInstruction(language);

  const prompt =
    `You are a senior Nigerian business strategist for BusinessRun. ` +
    `A founder just completed their business onboarding. Profile:\n\n` +
    `Business: ${businessName}\n` +
    `Stage: ${stage}\n` +
    `Sales Channel: ${salesChannel}\n` +
    `Monthly Revenue: ${revenue}\n` +
    `Biggest Headache: ${headache}\n\n` +
    `Generate a personalised roadmap insight in JSON with exactly these fields:\n` +
    `{\n` +
    `  "prioritySignal": "One punchy sentence (max 20 words) — their single most important focus.",\n` +
    `  "sectorFocus": "3-5 word label for their key focus area",\n` +
    `  "sectorDetail": "2-3 sentences of honest sector-specific insight. Reference Nigerian market realities.",\n` +
    `  "weeklyAction": "One specific task they can do this week. Start with a verb. Max 30 words.",\n` +
    `  "headacheAdvice": "2 sentences directly addressing ${headache}. Be practical and Nigeria-specific."\n` +
    `}\n\n` +
    `LANGUAGE INSTRUCTION: ${langInstruction}\n` +
    `Return ONLY valid JSON. No markdown, no explanation, no extra fields.`;

  const contents = [{ role: 'user', parts: [{ text: prompt }] }];

  const rawText = await callGemini(
    contents,
    `You are a senior Nigerian business strategist. ${langInstruction} Always respond in valid JSON only.`,
    { maxOutputTokens: 512, responseMimeType: 'application/json' }
  );

  const insight = parseJsonResponse(rawText);
  return { insight };
}


// ─────────────────────────────────────────────────────────────────
// 4. Digital CFO Insight (dashboard home refresh)
// ─────────────────────────────────────────────────────────────────

async function getCFOInsight({ profile, entriesByTool, language = 'English' }) {
  const { businessName, stage, salesChannel, headache } = profile;
  const langInstruction = getLanguageInstruction(language);

  // Build a plain-text summary of entries — no embedded newlines in template literals
  const summaryLines = [];
  Object.entries(entriesByTool).forEach(([tool, entries]) => {
    if (!entries || entries.length === 0) return;
    const total = entries.reduce(function(sum, e) { return sum + (parseFloat(e.amount) || 0); }, 0);
    summaryLines.push(tool + ' (' + entries.length + ' entries, total N' + total.toLocaleString() + '):');
    entries.slice(0, 10).forEach(function(e) {
      summaryLines.push('  - ' + e.date + ' | ' + e.category + ' | ' + e.description + ' | N' + Number(e.amount).toLocaleString());
    });
    summaryLines.push('');
  });
  const summary = summaryLines.join('\n');

  const promptLines = [
    'You are the Digital CFO for BusinessRun.',
    'A Nigerian business owner has logged their financial data.',
    'Analyse it and replace their generic dashboard insight with financially-informed advice.',
    '',
    'Business Profile:',
    '  Name: ' + businessName,
    '  Stage: ' + stage,
    '  Sales Channel: ' + salesChannel,
    '  Biggest Headache: ' + headache,
    '',
    'Financial Data:',
    summary,
    '',
    'Generate updated dashboard insight JSON with EXACTLY these fields:',
    '{',
    '  "prioritySignal": "One punchy sentence referencing their actual numbers. Max 25 words.",',
    '  "sectorFocus": "3-5 word label that reflects their actual financial focus area",',
    '  "sectorDetail": "2-3 sentences of financially-grounded insight. Reference actual figures. Nigeria-specific.",',
    '  "weeklyAction": "One specific financial action this week based on their data. Start with a verb. Max 30 words.",',
    '  "headacheAdvice": "2 sentences addressing the headache using their actual financial data as evidence."',
    '}',
    'LANGUAGE INSTRUCTION: ' + langInstruction,
    'Return ONLY valid JSON. No markdown, no explanation, no extra fields.',
  ];
  const prompt = promptLines.join('\n');

  const contents = [{ role: 'user', parts: [{ text: prompt }] }];

  const rawText = await callGemini(
    contents,
    'You are a Digital CFO for Nigerian SMEs. ' + langInstruction + ' Always respond in valid JSON only.',
    { maxOutputTokens: 600, responseMimeType: 'application/json' }
  );

  const insight = parseJsonResponse(rawText);
  return { insight };
}


// ─────────────────────────────────────────────────────────────────
// 5. Business Pulse — Cross-layer intelligence
// ─────────────────────────────────────────────────────────────────
/**
 * getBusinessPulse
 * Generates a unified Business Pulse by cross-referencing all three
 * data layers: CFO (financial), Inventory (operational), Sales (revenue).
 * Returns 3 targeted signals — one per layer — plus a priority action
 * that synthesises across all three.
 *
 * Called from the dashboard home tab after all data is loaded.
 * Only fires if at least one data layer has entries.
 *
 * @param {Object} profile      { businessName, stage, salesChannel, headache }
 * @param {Object} cfoEntries   { 'General Ledger': [...], ... }
 * @param {Object[]} inventory  Array of inventory items
 * @param {Object[]} sales      Array of sale records
 * @param {string} language     Selected language
 * @returns {Promise<{ pulse: Object }>}
 */
async function getBusinessPulse({ profile, cfoEntries, inventory, sales, language = 'English' }) {
  const { businessName, stage, salesChannel } = profile;
  const langInstruction = getLanguageInstruction(language);
  const lines = [];

  // ── CFO summary ───────────────────────────────────────────────
  const cfoTotals = {};
  Object.entries(cfoEntries || {}).forEach(([tool, entries]) => {
    if (!entries || entries.length === 0) return;
    const total = entries.reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0);
    cfoTotals[tool] = { count: entries.length, total };
  });
  if (Object.keys(cfoTotals).length > 0) {
    lines.push('CFO DATA:');
    Object.entries(cfoTotals).forEach(([tool, data]) => {
      lines.push('  ' + tool + ': ' + data.count + ' entries, total N' + data.total.toLocaleString());
    });
  }

  // ── Inventory summary ─────────────────────────────────────────
  const inv = inventory || [];
  if (inv.length > 0) {
    const totalValue   = inv.reduce(function(s, i) { return s + (i.unit_price * i.quantity); }, 0);
    const lowStock     = inv.filter(function(i) { return i.quantity <= 5; });
    const outOfStock   = inv.filter(function(i) { return i.quantity === 0; });
    lines.push('INVENTORY DATA:');
    lines.push('  Total SKUs: ' + inv.length);
    lines.push('  Total value: N' + totalValue.toLocaleString());
    lines.push('  Low stock items (<=5 units): ' + lowStock.length);
    if (lowStock.length > 0) {
      lines.push('  Low stock: ' + lowStock.slice(0, 5).map(function(i) { return i.name + ' (' + i.quantity + ' left)'; }).join(', '));
    }
    lines.push('  Out of stock: ' + outOfStock.length);
  }

  // ── Sales summary (last 30 records) ──────────────────────────
  const sl = (sales || []).slice(0, 30);
  if (sl.length > 0) {
    const totalRev      = sl.reduce(function(s, x) { return s + (x.totalAmount || 0); }, 0);
    const creditCount   = sl.filter(function(x) { return x.paymentStatus === 'Credit'; }).length;
    const discountCount = sl.filter(function(x) {
      const items = x.items || [];
      return items.some(function(l) { return l.salePrice < l.unitPrice; });
    }).length;
    const productFreq = {};
    sl.forEach(function(x) {
      const items = x.items || [{ itemName: x.itemName }];
      items.forEach(function(l) {
        if (l.itemName) productFreq[l.itemName] = (productFreq[l.itemName] || 0) + 1;
      });
    });
    const topProduct = Object.entries(productFreq).sort(function(a, b) { return b[1] - a[1]; })[0];
    lines.push('SALES DATA (last ' + sl.length + ' records):');
    lines.push('  Total revenue: N' + totalRev.toLocaleString());
    lines.push('  Credit sales: ' + creditCount + ' of ' + sl.length);
    lines.push('  Below-listed-price sales: ' + discountCount + ' of ' + sl.length);
    if (topProduct) lines.push('  Best-selling product: ' + topProduct[0] + ' (' + topProduct[1] + ' sales)');
  }

  if (lines.length === 0) return { pulse: null };

  const promptLines = [
    'You are the BusinessRun AI Brain — a unified business intelligence engine for Nigerian SMEs.',
    'Analyse the following cross-layer business data for ' + businessName + ' (' + stage + ' stage, ' + salesChannel + '):',
    '',
    lines.join('\n'),
    '',
    'Generate a Business Pulse in JSON with EXACTLY these fields:',
    '{',
    '  "financialSignal": "1-2 sentences on financial health based on CFO data. Be specific with numbers. Max 35 words.",',
    '  "inventorySignal": "1-2 sentences on stock health. Call out low stock risks by product name if available. Max 35 words.",',
    '  "salesSignal": "1-2 sentences on sales performance. Reference top product, discount patterns, or credit risk. Max 35 words.",',
    '  "priorityAction": "The single most important cross-layer action RIGHT NOW. Reference at least 2 data layers. Start with a verb. Max 40 words.",',
    '  "pulseScore": a number 1-10 rating overall business health based on the data (10 = excellent)',
    '}',
    '',
    'LANGUAGE INSTRUCTION: ' + langInstruction,
    'Return ONLY valid JSON. No markdown, no explanation, no extra fields.',
  ];

  const contents = [{ role: 'user', parts: [{ text: promptLines.join('\n') }] }];

  const rawText = await callGemini(
    contents,
    'You are the BusinessRun AI Brain for Nigerian SMEs. ' + langInstruction + ' Always respond in valid JSON only.',
    { maxOutputTokens: 600, responseMimeType: 'application/json' }
  );

  const pulse = parseJsonResponse(rawText);
  return { pulse };
}

module.exports = {
  getAdvisorReply,
  getAccountingReport,
  getRoadmapInsight,
  getCFOInsight,
  getBusinessPulse,
  SUPPORTED_LANGUAGES,
};
