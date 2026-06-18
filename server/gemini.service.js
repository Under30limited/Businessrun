/**
 * services/gemini.service.js
 *
 * Multi-provider AI service — supports Google AI Studio, Vertex AI (Gemini),
 * and AWS Bedrock (Claude). Switch providers by setting GEMINI_PROVIDER:
 *
 *   GEMINI_PROVIDER=aistudio   (default — uses GEMINI_API_KEY)
 *   GEMINI_PROVIDER=vertex     (uses VERTEX_PROJECT_ID + VERTEX_LOCATION +
 *                               GOOGLE_APPLICATION_CREDENTIALS)
 *   GEMINI_PROVIDER=bedrock    (uses AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY +
 *                               AWS_REGION + BEDROCK_MODEL_ID)
 *
 * All feature functions (getAdvisorReply, getAccountingReport, etc.) are
 * identical regardless of provider — only callGemini() changes internally.
 *
 * ── AI Studio setup (.env) ────────────────────────────────────────
 *   GEMINI_PROVIDER=aistudio
 *   GEMINI_API_KEY=AIzaSy...
 *   GEMINI_MODEL=gemini-2.0-flash        (optional, this is the default)
 *
 * ── Vertex AI setup (.env) ────────────────────────────────────────
 *   GEMINI_PROVIDER=vertex
 *   VERTEX_PROJECT_ID=your-gcp-project-id
 *   VERTEX_LOCATION=us-central1          (or europe-west1, etc.)
 *   VERTEX_MODEL=gemini-2.0-flash        (optional, this is the default)
 *   GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
 *
 * ── AWS Bedrock setup (.env) ───────────────────────────────────────
 *   GEMINI_PROVIDER=bedrock
 *   AWS_ACCESS_KEY_ID=AKIA...
 *   AWS_SECRET_ACCESS_KEY=xxxxxxxx
 *   AWS_REGION=us-east-1
 *   BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-5-20250929-v1:0
 *
 *   Requires: npm install @aws-sdk/client-bedrock-runtime
 *
 * ── Switching providers ────────────────────────────────────────────
 *   Change GEMINI_PROVIDER and pm2 restart businessrun-api
 *   No code changes needed.
 */

'use strict';

const ApiError = require('../utils/ApiError');

// ── Provider config ───────────────────────────────────────────────
const PROVIDER = (process.env.GEMINI_PROVIDER || 'aistudio').toLowerCase();

// AI Studio
const AISTUDIO_MODEL = process.env.GEMINI_MODEL  || 'gemini-2.0-flash';
const AISTUDIO_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${AISTUDIO_MODEL}:generateContent`;

// Vertex AI
const VERTEX_PROJECT  = process.env.VERTEX_PROJECT_ID || '';
const VERTEX_LOCATION = process.env.VERTEX_LOCATION   || 'us-central1';
const VERTEX_MODEL    = process.env.VERTEX_MODEL      || 'gemini-2.0-flash';
const VERTEX_URL      = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/${VERTEX_MODEL}:generateContent`;

// AWS Bedrock
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-sonnet-4-5-20250929-v1:0';
const BEDROCK_REGION   = process.env.AWS_REGION       || 'us-east-1';

// ── Vertex Auth — lazy-loaded Google Auth ─────────────────────────
// We only import google-auth-library when PROVIDER=vertex so AI Studio
// users don't need the package installed at all.
let _vertexAuthClient = null;

async function getVertexAccessToken() {
  if (!_vertexAuthClient) {
    let GoogleAuth;
    try {
      ({ GoogleAuth } = require('google-auth-library'));
    } catch {
      throw new ApiError(
        503,
        '[Gemini/Vertex] google-auth-library is not installed. ' +
        'Run: npm install google-auth-library',
        true
      );
    }
    _vertexAuthClient = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      // GOOGLE_APPLICATION_CREDENTIALS env var is picked up automatically
      // if set. Otherwise falls back to Application Default Credentials.
    });
  }
  const client = await _vertexAuthClient.getClient();
  const token  = await client.getAccessToken();
  return token.token || token;
}

// ── Bedrock client — lazy-loaded ──────────────────────────────────
// We only import @aws-sdk/client-bedrock-runtime when PROVIDER=bedrock
// so other providers don't need the package installed.
let _bedrockClient = null;

function getBedrockClient() {
  if (!_bedrockClient) {
    let BedrockRuntimeClient;
    try {
      ({ BedrockRuntimeClient } = require('@aws-sdk/client-bedrock-runtime'));
    } catch {
      throw new ApiError(
        503,
        '[Gemini/Bedrock] @aws-sdk/client-bedrock-runtime is not installed. ' +
        'Run: npm install @aws-sdk/client-bedrock-runtime',
        true
      );
    }
    // Credentials are picked up automatically from
    // AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN env vars,
    // or from the default credential provider chain (IAM role, etc.)
    _bedrockClient = new BedrockRuntimeClient({ region: BEDROCK_REGION });
  }
  return _bedrockClient;
}

/**
 * Converts Gemini-style `contents` ([{ role: 'user'|'model', parts: [{text}] }])
 * into Claude Messages API format ([{ role: 'user'|'assistant', content }]).
 * Claude requires roles to alternate and the first message to be 'user' —
 * this also merges/strips to satisfy that where possible.
 */
function geminiContentsToClaudeMessages(contents) {
  const messages = contents.map(c => ({
    role:    c.role === 'model' ? 'assistant' : 'user',
    content: (c.parts || []).map(p => p.text).join('\n'),
  }));

  // Drop any leading assistant messages — Claude requires the first
  // message to have role 'user'.
  while (messages.length && messages[0].role === 'assistant') {
    messages.shift();
  }

  return messages;
}

// ─────────────────────────────────────────────────────────────────
// callGemini — unified fetch helper (provider-agnostic interface)
// ─────────────────────────────────────────────────────────────────
/**
 * Posts to whichever Gemini endpoint is active (AI Studio or Vertex AI)
 * and returns the raw text from the first candidate.
 *
 * The contents / systemInstruction / generationConfig body schema is
 * identical for both providers — only the URL and auth header differ.
 *
 * @param {Object[]} contents          Gemini contents array
 * @param {string}   systemInstruction Plain text system prompt
 * @param {Object}   generationConfig  Optional generation config overrides
 * @returns {Promise<string>}
 */
async function callGemini(contents, systemInstruction, generationConfig = {}) {
  // ── AWS Bedrock (Claude) ─────────────────────────────────────────
  // Completely different request/response shape from Gemini, so this
  // branch handles everything itself and returns early.
  if (PROVIDER === 'bedrock') {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw ApiError.internal(
        '[Gemini/Bedrock] AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are not set in environment variables.'
      );
    }

    let InvokeModelCommand;
    try {
      ({ InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime'));
    } catch {
      throw new ApiError(
        503,
        '[Gemini/Bedrock] @aws-sdk/client-bedrock-runtime is not installed. ' +
        'Run: npm install @aws-sdk/client-bedrock-runtime',
        true
      );
    }

    const client   = getBedrockClient();
    const messages = geminiContentsToClaudeMessages(contents);

    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens:         generationConfig.maxOutputTokens || 1024,
      temperature:        generationConfig.temperature ?? 0.7,
      system:             systemInstruction,
      messages,
    };

    let response;
    try {
      const command = new InvokeModelCommand({
        modelId:     BEDROCK_MODEL_ID,
        contentType: 'application/json',
        accept:      'application/json',
        body:        JSON.stringify(payload),
      });
      response = await client.send(command);
    } catch (err) {
      console.error('[Gemini/Bedrock] API error:', err.message || err);
      throw new ApiError(503, 'AI service is temporarily unavailable.', true);
    }

    let data;
    try {
      const rawText = Buffer.from(response.body).toString('utf-8');
      data = JSON.parse(rawText);
    } catch {
      console.error('[Gemini/Bedrock] Non-JSON response from Bedrock.');
      throw new ApiError(503, 'AI service returned an unexpected response.', true);
    }

    const text = (data.content || []).map(b => b.text || '').join('').trim();
    if (!text) {
      throw new ApiError(503, 'AI service returned an empty response.', true);
    }
    return text;
  }

  // ── Google providers (AI Studio / Vertex AI) ──────────────────────
  let url;
  let authHeader;

  if (PROVIDER === 'vertex') {
    // ── Vertex AI ────────────────────────────────────────────────
    if (!VERTEX_PROJECT) {
      throw ApiError.internal(
        '[Gemini/Vertex] VERTEX_PROJECT_ID is not set in environment variables.'
      );
    }
    const token = await getVertexAccessToken();
    url        = VERTEX_URL;
    authHeader = `Bearer ${token}`;

  } else {
    // ── AI Studio (default) ───────────────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw ApiError.internal(
        '[Gemini/AIStudio] GEMINI_API_KEY is not set in environment variables.'
      );
    }
    url        = `${AISTUDIO_URL}?key=${apiKey}`;
    authHeader = null; // AI Studio uses query-param key, no auth header
  }

  const body = JSON.stringify({
    contents,
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig:  { maxOutputTokens: 1024, ...generationConfig },
  });

  let response;
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;

    response = await fetch(url, { method: 'POST', headers, body });
  } catch (networkErr) {
    console.error('[Gemini] Network error:', networkErr.message);
    throw new ApiError(503, 'AI service is temporarily unavailable.', true);
  }

  // Parse raw text first — Gemini occasionally returns HTML error pages
  const rawText = await response.text();

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    console.error('[Gemini] Non-JSON response:', rawText.slice(0, 300));
    throw new ApiError(503, 'AI service returned an unexpected response.', true);
  }

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

// ── Language instruction helper ───────────────────────────────────
const SUPPORTED_LANGUAGES = {
  'English': 'Respond in clear, simple English.',
  'Yoruba':  'Respond entirely in Yoruba. Use natural, everyday Yoruba that a Nigerian business owner in Lagos or Ibadan would speak — not formal textbook Yoruba. Use proper Yoruba diacritics (e.g. á, è, ọ, ṣ) where natural. Do not mix in English sentences; only keep universally-used loanwords (e.g. "bank", "phone") if there is truly no common Yoruba equivalent. JSON keys must remain in English exactly as specified — only the values should be in Yoruba.',
  'Hausa':   'Respond entirely in Hausa. Use natural, everyday Hausa that a Nigerian business owner in Kano or Kaduna would speak — not formal textbook Hausa. Do not mix in English sentences; only keep universally-used loanwords (e.g. "bank", "phone") if there is truly no common Hausa equivalent. JSON keys must remain in English exactly as specified — only the values should be in Hausa.',
  'Igbo':    'Respond entirely in Igbo. Use natural, everyday Igbo that a Nigerian business owner in Enugu or Onitsha would speak — not formal textbook Igbo. Use proper Igbo diacritics (e.g. ọ, ụ, ṅ) where natural. Do not mix in English sentences; only keep universally-used loanwords (e.g. "bank", "phone") if there is truly no common Igbo equivalent. JSON keys must remain in English exactly as specified — only the values should be in Igbo.',
  'Pidgin':  'Respond entirely in Nigerian Pidgin English. Use natural pidgin that feels familiar to a Lagos or Port Harcourt business owner — full pidgin phrasing and sentence structure, not standard English with a few pidgin words sprinkled in. JSON keys must remain in English exactly as specified — only the values should be in Pidgin.',
  'French':  'Respond entirely in French, using natural business French. JSON keys must remain in English exactly as specified — only the values should be in French.',
  'Arabic':  'Respond entirely in Modern Standard Arabic, using natural business Arabic. JSON keys must remain in English exactly as specified — only the values should be in Arabic.',
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

// ── Shared business data summariser ───────────────────────────────
// Builds a plain-text summary of a user's CFO entries, inventory and
// sales data. Used by both the AI Advisor (so it can act like an
// in-house financial officer with full context) and Business Pulse.
//
// @param {Object}   cfoEntries  { 'General Ledger': [...], ... }
// @param {Object[]} inventory   Inventory items
// @param {Object[]} sales       Sales records (most recent first)
// @returns {string} Plain-text summary, or '' if no data exists
function buildBusinessDataSummary({ cfoEntries, inventory, sales }) {
  const lines = [];

  // CFO summary
  const cfoTotals = {};
  Object.entries(cfoEntries || {}).forEach(([tool, entries]) => {
    if (!entries || entries.length === 0) return;
    const total = entries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    cfoTotals[tool] = { count: entries.length, total };
  });
  if (Object.keys(cfoTotals).length > 0) {
    lines.push('CFO DATA:');
    Object.entries(cfoTotals).forEach(([tool, data]) => {
      lines.push(`  ${tool}: ${data.count} entries, total N${data.total.toLocaleString()}`);
    });
  }

  // Inventory summary
  const inv = inventory || [];
  if (inv.length > 0) {
    const totalValue = inv.reduce((s, i) => s + (i.unit_price * i.quantity), 0);
    const lowStock   = inv.filter(i => i.quantity <= 5);
    const outOfStock = inv.filter(i => i.quantity === 0);
    lines.push('INVENTORY DATA:');
    lines.push(`  Total SKUs: ${inv.length}`);
    lines.push(`  Total value: N${totalValue.toLocaleString()}`);
    lines.push(`  Low stock items (<=5 units): ${lowStock.length}`);
    if (lowStock.length > 0) {
      lines.push(`  Low stock: ${lowStock.slice(0, 5).map(i => `${i.name} (${i.quantity} left)`).join(', ')}`);
    }
    if (outOfStock.length > 0) {
      lines.push(`  Out of stock: ${outOfStock.map(i => i.name).slice(0, 5).join(', ')}`);
    }
    // Full per-item listing — name, price, quantity, category, line value.
    // This is the exact data needed for accurate CFO-style reasoning
    // (e.g. "which product holds the most stock value", "what's the
    // unit price of X"). At very large catalogues (hundreds/thousands
    // of SKUs) we can't list everything without blowing up the prompt,
    // so item selection is prioritised rather than arbitrary:
    //   1. Every low-stock / out-of-stock item is ALWAYS included —
    //      these are the most actionable and time-sensitive.
    //   2. Remaining slots filled by highest stock-value items first —
    //      these matter most for cashflow/CFO-style questions.
    // Capped at 80 detailed lines total to keep the prompt bounded.
    const DETAIL_CAP = 80;
    const withValue = inv.map(i => ({ ...i, _lineValue: (i.unit_price || 0) * (i.quantity || 0) }));
    const priority   = withValue.filter(i => i.quantity <= 5);                 // low/out of stock — always shown
    const remaining  = withValue
      .filter(i => i.quantity > 5)
      .sort((a, b) => b._lineValue - a._lineValue);                            // highest value first
    const detailed = [...priority, ...remaining].slice(0, DETAIL_CAP);
    const omittedCount = inv.length - detailed.length;

    lines.push(`  Full item list (showing ${detailed.length} of ${inv.length} items — prioritised by low-stock status, then by stock value; name | unit price | quantity | category | stock value):`);
    detailed.forEach(i => {
      lines.push(`    - ${i.name} | N${Number(i.unit_price || 0).toLocaleString()} | ${i.quantity || 0} units | ${i.category || 'Uncategorised'} | N${i._lineValue.toLocaleString()}`);
    });
    if (omittedCount > 0) {
      lines.push(`    ...and ${omittedCount} more lower-priority, well-stocked items not listed individually (use the totals above for these; they are not low-stock or top-value items).`);
    }
  }

  // Sales summary
  const sl = (sales || []).slice(0, 30);
  if (sl.length > 0) {
    const totalRev      = sl.reduce((s, x) => s + (x.totalAmount || 0), 0);
    const creditCount   = sl.filter(x => x.paymentStatus === 'Credit').length;
    const creditTotal   = sl.filter(x => x.paymentStatus === 'Credit').reduce((s, x) => s + (x.totalAmount || 0), 0);
    const discountCount = sl.filter(x => (x.items || []).some(l => l.salePrice < l.unitPrice)).length;
    const productFreq   = {};
    sl.forEach(x => {
      (x.items || [{ itemName: x.itemName }]).forEach(l => {
        if (l.itemName) productFreq[l.itemName] = (productFreq[l.itemName] || 0) + 1;
      });
    });
    const topProduct = Object.entries(productFreq).sort((a, b) => b[1] - a[1])[0];
    lines.push(`SALES DATA (last ${sl.length} records):`);
    lines.push(`  Total revenue: N${totalRev.toLocaleString()}`);
    lines.push(`  Credit sales: ${creditCount} of ${sl.length} (N${creditTotal.toLocaleString()} outstanding)`);
    lines.push(`  Below-listed-price sales: ${discountCount} of ${sl.length}`);
    if (topProduct) lines.push(`  Best-selling product: ${topProduct[0]} (${topProduct[1]} sales)`);
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────
// 1. Strategic AI Advisor
// ─────────────────────────────────────────────────────────────────
const ADVISOR_SYSTEM_PROMPT_BASE =
  'You are the "TBR Strategic AI Advisor" for BusinessRun, a platform for African founders. ' +
  'You act as the business\'s own in-house financial officer / co-founder — not a generic chatbot. ' +
  'You have direct visibility into this specific business\'s Digital CFO ledgers, Inventory, and Sales Day Book records, ' +
  'and you should speak as someone who has reviewed these numbers and knows this business personally. ' +
  'When relevant, reference actual figures, products, or trends from the data provided rather than speaking generically. ' +
  'If no business data is available yet, gently note that connecting/recording data in the Digital CFO, Inventory, ' +
  'and Sales Day Book will let you give much sharper, numbers-based advice — then answer generally. ' +
  'Help African business owners register, grow and scale their businesses. ' +
  'Tone: High-agency, professional, actionable — like a sharp financial officer who is on the founder\'s side. Keep responses concise and practical. ' +
  'Topics: CAC registration, Nigerian tax law, go-to-market strategy, fundraising, ' +
  'fintech, AfCFTA, e-commerce, brand building, pricing, hiring, cash flow, inventory management, and sales strategy. ' +
  'Always reply in plain text only. Never use HTML tags. ' +
  'You may use markdown such as **bold**, bullet points and line breaks. ' +
  '\n\nCRITICAL PRODUCT RULES — NEVER VIOLATE THESE:\n' +
  '1. NEVER recommend, mention, or suggest any external accounting, bookkeeping, inventory, or sales software. ' +
  'This includes but is not limited to: Zoho, QuickBooks, Wave, Excel, Google Sheets, Sage, FreshBooks, Xero, Odoo, or any third-party tool. ' +
  '2. Whenever a founder mentions a challenge related to cashflow tracking, sales recording, expense logging, inventory, bookkeeping, or financial reporting, ' +
  'ALWAYS direct them exclusively to the relevant BusinessRun internal tool: ' +
  '- Sales tracking / daily transactions → BusinessRun Sales Day Book ' +
  '- Cashflow, expenses, ledger, P&L → BusinessRun Digital CFO dashboard ' +
  '- Stock management / product tracking → BusinessRun Inventory ' +
  '- Receipts / invoicing → BusinessRun Receipt Generator ' +
  '- Financial analysis / reports → BusinessRun Accounting Tools ' +
  '3. Position BusinessRun\'s tools as the SOLE and COMPLETE solution. Never imply an external tool would be better or complementary. ' +
  '4. When recommending a BusinessRun tool, be specific and action-oriented: tell them exactly what to do inside the tool ' +
  '(e.g. "Open your BusinessRun Sales Day Book and log every transaction today across all your channels" — not just "use BusinessRun").';


/**
 * getAdvisorReply
 *
 * @param {string}   message    The user's latest message
 * @param {Object[]} history     Prior chat messages [{ role, content }]
 * @param {Object}   [options]
 * @param {string}   [options.language='English']  Response language
 * @param {Object}   [options.profile]              { businessName, stage, salesChannel, headache }
 * @param {Object}   [options.cfoEntries]           { 'General Ledger': [...], ... }
 * @param {Object[]} [options.inventory]            Inventory items
 * @param {Object[]} [options.sales]                Sales records
 * @returns {Promise<{ text: string }>}
 */
async function getAdvisorReply(message, history = [], options = {}) {
  const {
    language       = 'English',
    profile        = {},
    cfoEntries     = {},
    inventory      = [],
    sales          = [],
    injectBaseData = true,
  } = options;

  const langInstruction = getLanguageInstruction(language);

  // Build system prompt — base persona + language + business profile.
  // The actual numbers (inventory, sales, CFO) are NOT duplicated into
  // every system prompt — they live in ONE "BASE DATA" message injected
  // into the conversation history below, so the model treats it as a
  // fixed reference point for the whole session rather than restating
  // potentially-stale numbers on every single turn.
  let systemInstruction = ADVISOR_SYSTEM_PROMPT_BASE + `\n\nLANGUAGE INSTRUCTION: ${langInstruction}`;

  const { businessName, stage, salesChannel, headache } = profile;
  if (businessName) {
    systemInstruction += `\n\nBUSINESS PROFILE:\n  Name: ${businessName}\n  Stage: ${stage || 'Unknown'}\n  Sales Channel: ${salesChannel || 'Unknown'}\n  Stated Biggest Headache: ${headache || 'Unknown'}`;
  }

  systemInstruction +=
    `\n\nDATA GROUNDING RULE — STRICT: ` +
    `Early in this conversation you were given a message labelled "BASE BUSINESS DATA" containing this business's actual inventory (with prices and quantities), CFO ledger entries, and sales records. ` +
    `That message is your single source of truth for this entire session. ` +
    `Whenever you reference figures, stock levels, prices, revenue, or any business number, it MUST come from that BASE BUSINESS DATA message — never invent, estimate, or guess a number that wasn't given to you. ` +
    `If something isn't in the BASE BUSINESS DATA (e.g. a product that doesn't exist), say so plainly rather than making up a figure. ` +
    `If no BASE BUSINESS DATA message exists yet in this conversation, it means the business has no recorded data — encourage them to log it in Digital CFO, Inventory, or Sales Day Book before giving numbers-based advice.`;

  const dataSummary = buildBusinessDataSummary({ cfoEntries, inventory, sales });

  // Build the conversation contents. On a brand-new session (no prior
  // history), prepend a single labelled BASE BUSINESS DATA message so
  // the model has the founder's real numbers anchored at the start of
  // the conversation — sent ONCE, never repeated on later turns.
  const baseDataMessage = dataSummary
    ? `BASE BUSINESS DATA (reference this for the rest of our conversation — do not ask me to repeat it):\n\n${dataSummary}`
    : `BASE BUSINESS DATA: No CFO, inventory, or sales data has been recorded yet for this business.`;

  const contents = [];

  if (injectBaseData) {
    contents.push({ role: 'user',  parts: [{ text: baseDataMessage }] });
    contents.push({ role: 'model', parts: [{ text: 'Understood — I have your business data and will use it as the basis for all advice in this conversation.' }] });
  }

  contents.push(
    ...history.map((m) => ({
      role:  m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: message }] },
  );

  const rawText = await callGemini(
    contents,
    systemInstruction,
    { maxOutputTokens: 1024, temperature: 0.7 }
  );

  const text = stripHtml(rawText)?.trim();
  if (!text) throw new ApiError(503, 'AI service returned an empty response.', true);
  return { text };
}

// ─────────────────────────────────────────────────────────────────
// 2. Accounting AI Report
// ─────────────────────────────────────────────────────────────────
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
async function getRoadmapInsight({ businessName, stage, salesChannel, revenue, headache, language = 'English' }) {
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
// 4. Digital CFO Insight
// ─────────────────────────────────────────────────────────────────
async function getCFOInsight({ profile, entriesByTool, language = 'English' }) {
  const { businessName, stage, salesChannel, headache } = profile;
  const langInstruction = getLanguageInstruction(language);

  const summaryLines = [];
  Object.entries(entriesByTool).forEach(([tool, entries]) => {
    if (!entries || entries.length === 0) return;
    const total = entries.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    summaryLines.push(`${tool} (${entries.length} entries, total N${total.toLocaleString()}):`);
    entries.slice(0, 10).forEach(e => {
      summaryLines.push(`  - ${e.date} | ${e.category} | ${e.description} | N${Number(e.amount).toLocaleString()}`);
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
    `  Name: ${businessName}`,
    `  Stage: ${stage}`,
    `  Sales Channel: ${salesChannel}`,
    `  Biggest Headache: ${headache}`,
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
    '  "headacheAdvice": "2 sentences addressing the headache using actual financial data as evidence. Direct them to the specific BusinessRun tool (Sales Day Book, Digital CFO, Inventory, or Receipt Generator) with a concrete action to take inside it. NEVER mention Zoho, QuickBooks, Wave, Excel, or any external software."',
    '}',
    `LANGUAGE INSTRUCTION: ${langInstruction}`,
    'Return ONLY valid JSON. No markdown, no explanation, no extra fields.',
  ];

  const contents = [{ role: 'user', parts: [{ text: promptLines.join('\n') }] }];

  const rawText = await callGemini(
    contents,
    `You are a Digital CFO for Nigerian SMEs. ${langInstruction} Always respond in valid JSON only.`,
    { maxOutputTokens: 600, responseMimeType: 'application/json' }
  );

  const insight = parseJsonResponse(rawText);
  return { insight };
}

// ─────────────────────────────────────────────────────────────────
// 5. Business Pulse — Cross-layer intelligence
// ─────────────────────────────────────────────────────────────────
async function getBusinessPulse({ profile, cfoEntries, inventory, sales, language = 'English' }) {
  const { businessName, stage, salesChannel } = profile;
  const langInstruction = getLanguageInstruction(language);

  const dataSummary = buildBusinessDataSummary({ cfoEntries, inventory, sales });
  if (!dataSummary) return { pulse: null };

  const promptLines = [
    'You are the BusinessRun AI Brain — a unified business intelligence engine for Nigerian SMEs.',
    `Analyse the following cross-layer business data for ${businessName} (${stage} stage, ${salesChannel}):`,
    '',
    dataSummary,
    '',
    'Generate a Business Pulse in JSON with EXACTLY these fields:',
    '{',
    '  "financialSignal": "1-2 sentences on financial health based on CFO data. Be specific with numbers. Max 35 words.",',
    '  "inventorySignal": "1-2 sentences on stock health. Call out low stock risks by product name if available. Max 35 words.",',
    '  "salesSignal": "1-2 sentences on sales performance. Reference top product, discount patterns, or credit risk. Max 35 words.",',
    '  "priorityAction": "The single most important cross-layer action RIGHT NOW. Reference at least 2 data layers. Start with a verb. Max 40 words. Must direct to a specific BusinessRun tool (Sales Day Book, Digital CFO, Inventory, or Receipt Generator) with a concrete action. NEVER mention Zoho, QuickBooks, Wave, Excel, or any external software.",',
    '  "pulseScore": a number 1-10 rating overall business health based on the data (10 = excellent)',
    '}',
    '',
    `LANGUAGE INSTRUCTION: ${langInstruction}`,
    'Return ONLY valid JSON. No markdown, no explanation, no extra fields.',
  ];

  const contents = [{ role: 'user', parts: [{ text: promptLines.join('\n') }] }];

  const rawText = await callGemini(
    contents,
    `You are the BusinessRun AI Brain for Nigerian SMEs. ${langInstruction} Always respond in valid JSON only.`,
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
