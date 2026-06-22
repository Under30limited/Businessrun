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
  const now  = new Date();
  const lines = [];

  // ── Helper: format date ────────────────────────────────────────
  function fmtDate(iso) {
    if (!iso) return 'unknown date';
    try {
      return new Date(iso).toLocaleDateString('en-NG', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
    } catch { return iso; }
  }

  // ── Helper: days since a date ──────────────────────────────────
  function daysSince(iso) {
    if (!iso) return null;
    try {
      const diff = now - new Date(iso);
      return Math.floor(diff / (1000 * 60 * 60 * 24));
    } catch { return null; }
  }

  // ── CFO entries — totals + individual entry detail ─────────────
  // We show per-tool totals for a high-level view, then individual
  // entry descriptions and dates (capped at 15 per tool) so the agent
  // can spot expense patterns, flag suspicious categories, and reason
  // about timing (e.g. "you spent heavily on transport in May").
  const allCfoEntries = Object.entries(cfoEntries || {});
  if (allCfoEntries.some(([, entries]) => entries && entries.length > 0)) {
    lines.push('CFO ENTRIES:');
    allCfoEntries.forEach(([tool, entries]) => {
      if (!entries || entries.length === 0) return;
      const total    = entries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
      const income   = entries.filter(e => parseFloat(e.amount) > 0).reduce((s, e) => s + parseFloat(e.amount), 0);
      const expenses = entries.filter(e => parseFloat(e.amount) < 0).reduce((s, e) => s + parseFloat(e.amount), 0);
      lines.push(`  ${tool}: ${entries.length} entries | Total: N${total.toLocaleString()} | Income: N${income.toLocaleString()} | Expenses: N${Math.abs(expenses).toLocaleString()}`);
      // Category frequency — what is money being spent on most?
      const catFreq = {};
      entries.forEach(e => {
        if (e.category) catFreq[e.category] = (catFreq[e.category] || 0) + Math.abs(parseFloat(e.amount) || 0);
      });
      const topCats = Object.entries(catFreq).sort((a, b) => b[1] - a[1]).slice(0, 5);
      if (topCats.length > 0) {
        lines.push(`    Top spend categories: ${topCats.map(([c, v]) => `${c} (N${v.toLocaleString()})`).join(', ')}`);
      }
      // Individual entries (most recent first, capped at 15)
      const recent = [...entries].sort((a, b) => new Date(b.date || b.savedAt || 0) - new Date(a.date || a.savedAt || 0)).slice(0, 15);
      lines.push(`    Recent entries (showing ${recent.length} of ${entries.length}):`);
      recent.forEach(e => {
        lines.push(`      • ${fmtDate(e.date || e.savedAt)} | ${e.category || 'Uncategorised'} | ${e.description || 'No description'} | N${Number(e.amount || 0).toLocaleString()}`);
      });
    });
  }

  // ── Inventory — prioritised per-item detail with time signals ──
  const inv = inventory || [];
  if (inv.length > 0) {
    const totalValue = inv.reduce((s, i) => s + ((i.unit_price || 0) * (i.quantity || 0)), 0);
    const lowStock   = inv.filter(i => i.quantity > 0 && i.quantity <= 5);
    const outOfStock = inv.filter(i => i.quantity === 0);

    // Dead stock detection — items added >30 days ago still fully in stock
    const deadStock = inv.filter(i => {
      const days = daysSince(i.createdAtISO);
      return days !== null && days > 30 && i.quantity > 10;
    });

    lines.push('INVENTORY DATA:');
    lines.push(`  Total SKUs: ${inv.length}`);
    lines.push(`  Total inventory value: N${totalValue.toLocaleString()}`);
    lines.push(`  Out of stock: ${outOfStock.length} items${outOfStock.length > 0 ? ' — ' + outOfStock.slice(0, 5).map(i => i.name).join(', ') : ''}`);
    lines.push(`  Low stock (1–5 units): ${lowStock.length} items${lowStock.length > 0 ? ' — ' + lowStock.slice(0, 5).map(i => `${i.name} (${i.quantity} left)`).join(', ') : ''}`);
    if (deadStock.length > 0) {
      lines.push(`  Possible dead stock (>30 days old, >10 units still in stock): ${deadStock.slice(0, 5).map(i => `${i.name} (${daysSince(i.createdAtISO)}d old, ${i.quantity} units)`).join(', ')}`);
    }

    // ── Tiered item listing ───────────────────────────────────────
    // Tier 1 (≤300 items): full per-item detail for every SKU —
    //   the agent has complete awareness of the entire catalogue.
    // Tier 2 (>300 items): aggregates + 100 priority items + a note
    //   telling the agent it can ask for specific items by name.
    // Prioritisation: low/out-of-stock always first, then by stock value.
    const FULL_CAP     = 300;
    const PRIORITY_CAP = 100;
    const withMeta = inv.map(i => ({
      ...i,
      _lineValue: (i.unit_price || 0) * (i.quantity || 0),
      _daysSince: daysSince(i.createdAtISO),
    }));
    const priority  = withMeta.filter(i => i.quantity <= 5);
    const remaining = withMeta.filter(i => i.quantity > 5).sort((a, b) => b._lineValue - a._lineValue);
    const sorted    = [...priority, ...remaining];
    const isLargeCatalogue = inv.length > FULL_CAP;
    const detailed  = sorted.slice(0, isLargeCatalogue ? PRIORITY_CAP : inv.length);
    const omitted   = inv.length - detailed.length;

    if (isLargeCatalogue) {
      lines.push(`  LARGE CATALOGUE NOTE: This business has ${inv.length} SKUs — too many to list individually without exceeding context. The ${detailed.length} most actionable items are listed below (low-stock first, then highest stock value). For any other specific product not listed, you can tell the founder you can look it up if they give you the exact name.`);
    }
    lines.push(`  Item list (${detailed.length}${isLargeCatalogue ? ' priority items' : ''} of ${inv.length} — name | unit price | qty | category | stock value | date added | days in stock):`);
    detailed.forEach(i => {
      const added = i.createdAtISO ? fmtDate(i.createdAtISO) : 'unknown';
      const days  = i._daysSince !== null ? `${i._daysSince}d` : '?';
      lines.push(`    - ${i.name} | N${Number(i.unit_price || 0).toLocaleString()} | ${i.quantity || 0} units | ${i.category || 'Uncategorised'} | N${i._lineValue.toLocaleString()} | ${added} | ${days}`);
    });
    if (omitted > 0 && !isLargeCatalogue) {
      lines.push(`    ...and ${omitted} more items omitted.`);
    }
  }

  // ── Sales — aggregates + individual records with people data ───
  // ── Tiered sales listing ──────────────────────────────────────
  // Tier 1 (≤200 records): full individual sale detail for every record.
  // Tier 2 (>200 records): aggregates + 100 most recent individual records.
  const SALES_FULL_CAP     = 200;
  const SALES_PRIORITY_CAP = 100;
  const allSales    = sales || [];
  const isLargeSalesLog = allSales.length > SALES_FULL_CAP;
  const sl = [...allSales]
    .sort((a, b) => new Date(b.saleDateISO || 0) - new Date(a.saleDateISO || 0))
    .slice(0, isLargeSalesLog ? SALES_PRIORITY_CAP : allSales.length);
  if (sl.length > 0) {
    const totalRev   = sl.reduce((s, x) => s + (x.totalAmount || 0), 0);
    const paidRev    = sl.filter(x => x.paymentStatus === 'Paid').reduce((s, x) => s + (x.totalAmount || 0), 0);
    const creditSales = sl.filter(x => x.paymentStatus === 'Credit');
    const creditTotal = creditSales.reduce((s, x) => s + (x.totalAmount || 0), 0);
    const discounted  = sl.filter(x => (x.items || []).some(l => l.salePrice < l.unitPrice));

    // Product frequency
    const productFreq = {};
    sl.forEach(x => {
      (x.items || [{ itemName: x.itemName }]).forEach(l => {
        if (l.itemName) productFreq[l.itemName] = (productFreq[l.itemName] || 0) + (l.quantity || 1);
      });
    });
    const topProducts = Object.entries(productFreq).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Sales channel breakdown
    const channelFreq = {};
    sl.forEach(x => { const c = x.pointOfSale || 'Walk-in'; channelFreq[c] = (channelFreq[c] || 0) + 1; });
    const topChannels = Object.entries(channelFreq).sort((a, b) => b[1] - a[1]);

    // Repeat buyers
    const buyerFreq = {};
    sl.forEach(x => { if (x.buyerName) buyerFreq[x.buyerName] = (buyerFreq[x.buyerName] || 0) + 1; });
    const repeatBuyers = Object.entries(buyerFreq).filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]);

    // Staff recording frequency
    const staffFreq = {};
    sl.forEach(x => { if (x.recordedBy) staffFreq[x.recordedBy] = (staffFreq[x.recordedBy] || 0) + 1; });
    const staffList = Object.entries(staffFreq).sort((a, b) => b[1] - a[1]);

    // Day-of-week pattern
    const dayFreq = { Mon:0, Tue:0, Wed:0, Thu:0, Fri:0, Sat:0, Sun:0 };
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    sl.forEach(x => {
      const iso = x.saleDateISO || x.saleDate;
      if (iso) { try { dayFreq[dayNames[new Date(iso).getDay()]]++; } catch {} }
    });
    const bestDay = Object.entries(dayFreq).sort((a, b) => b[1] - a[1])[0];

    lines.push(`SALES DATA (last ${sl.length} records):`);
    lines.push(`  Total revenue: N${totalRev.toLocaleString()}`);
    lines.push(`  Cash received (Paid): N${paidRev.toLocaleString()}`);
    lines.push(`  Credit outstanding: N${creditTotal.toLocaleString()} across ${creditSales.length} sale(s)`);
    if (creditSales.length > 0) {
      lines.push(`  Credit debtors: ${creditSales.slice(0, 5).map(x => `${x.buyerName || 'Unknown'} (N${Number(x.totalAmount).toLocaleString()})`).join(', ')}`);
    }
    lines.push(`  Below-price (discounted) sales: ${discounted.length} of ${sl.length}`);
    if (topProducts.length > 0) {
      lines.push(`  Top-selling products (by units): ${topProducts.map(([n, c]) => `${n} (${c} units)`).join(', ')}`);
    }
    if (topChannels.length > 0) {
      lines.push(`  Sales by channel: ${topChannels.map(([c, n]) => `${c} (${n})`).join(', ')}`);
    }
    if (repeatBuyers.length > 0) {
      lines.push(`  Repeat buyers: ${repeatBuyers.slice(0, 5).map(([n, c]) => `${n} (${c} purchases)`).join(', ')}`);
    }
    if (staffList.length > 0) {
      lines.push(`  Sales recorded by staff: ${staffList.map(([n, c]) => `${n} (${c} sales)`).join(', ')}`);
    }
    if (bestDay && bestDay[1] > 0) {
      lines.push(`  Best sales day of week: ${bestDay[0]} (${bestDay[1]} sales)`);
    }

    if (isLargeSalesLog) {
      lines.push(`  LARGE SALES LOG NOTE: This business has ${allSales.length} total sales records. The ${sl.length} most recent are listed individually below. All aggregates above cover the full history.`);
    }
    lines.push(`  Individual sale records (${sl.length} shown${isLargeSalesLog ? `, most recent of ${allSales.length} total` : ''}):`);
    sl.forEach(x => {
      const items   = (x.items || [{ itemName: x.itemName, quantity: x.quantity, salePrice: x.salePrice }])
        .map(l => `${l.itemName} x${l.quantity} @N${Number(l.salePrice || 0).toLocaleString()}`).join(', ');
      const buyer   = x.buyerName    ? ` | Buyer: ${x.buyerName}${x.buyerContact ? ` (${x.buyerContact})` : ''}` : '';
      const staff   = x.recordedBy   ? ` | Recorded by: ${x.recordedBy}` : '';
      const channel = x.pointOfSale  ? ` | via ${x.pointOfSale}` : '';
      const method  = x.paymentMethod ? ` | ${x.paymentMethod}` : '';
      const status  = ` | ${x.paymentStatus || 'Paid'}`;
      lines.push(`    • ${fmtDate(x.saleDateISO)} | N${Number(x.totalAmount || 0).toLocaleString()}${status}${method}${channel}${buyer}${staff} | ${items}`);
    });
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────
// 1. Strategic AI Advisor
// ─────────────────────────────────────────────────────────────────
const ADVISOR_SYSTEM_PROMPT_BASE =
  // ── Identity & Role ───────────────────────────────────────────
  'You are the "TBR Strategic AI Advisor" — the embedded financial intelligence officer for BusinessRun, ' +
  'a platform built for African SME founders and retailers. ' +
  'You are not a generic chatbot. You are this specific business\'s in-house CFO, strategist, and growth advisor ' +
  'who has read their books, reviewed their inventory, studied their sales history, and knows their numbers intimately. ' +
  'Speak like a sharp, experienced financial officer who is completely on the founder\'s side — ' +
  'direct, actionable, no fluff, no generic advice that could apply to any business. ' +

  // ── Data grounding ─────────────────────────────────────────────
  'You have been given BASE BUSINESS DATA at the start of this conversation — ' +
  'containing this founder\'s actual inventory (every item with its price, quantity, category, date added, and days in stock — ' +
  'or the most important items if the catalogue is very large), ' +
  'their CFO ledger entries (with descriptions, categories, dates, and amounts), ' +
  'and their sales records (all records if under 200, or the most recent 100 if the log is larger — ' +
  'with buyer names and contacts, staff who recorded the sale, ' +
  'payment method, payment status, sales channel, date, and individual line items). ' +
  'This is your single source of truth. Reference these exact figures whenever you give advice. ' +
  'Never invent, estimate, or assume a number that was not given to you. ' +
  'If asked about a specific product or sale not visible in your data, say: ' +
  '"I don\'t have that specific item in my current view — can you confirm the exact name and I\'ll check the details for you." ' +
  'If the founder asks for analysis across all records (e.g. "what\'s my total revenue ever"), ' +
  'use the aggregates provided which always cover the full dataset, not just the individual records listed. ' +

  // ── Intelligence capabilities ──────────────────────────────────
  'You are capable of the following types of analysis and should proactively surface insights when relevant:\n' +
  '• CASH FLOW: Total cash received vs credit outstanding. Flag credit debtors by name and amount.\n' +
  '• DEAD STOCK: Inventory items that have been sitting for 30+ days with high quantity — flag these explicitly.\n' +
  '• MARGIN ANALYSIS: If cost data is available, compute gross margin per product. Otherwise flag sell-below-list-price patterns.\n' +
  '• REPEAT CUSTOMERS: Identify repeat buyers from the sales records — these are your most valuable customers.\n' +
  '• STAFF PERFORMANCE: If recordedBy data exists, note which staff members are logging the most sales.\n' +
  '• SALES PATTERNS: Best-performing day of week, best channel (Walk-in vs WhatsApp vs Instagram etc.), and trending products.\n' +
  '• RESTOCK ALERTS: Proactively flag any item below 5 units or out of stock, especially top sellers.\n' +
  '• CFO PATTERNS: Identify top expense categories, flag any categories that appear unusually frequent, ' +
  'and compare income vs expenses across time periods if dates are available.\n' +
  '• CREDIT RISK: Name any credit (unpaid) buyers, total amount owed, and suggest follow-up action.\n' +

  // ── Tone & format ──────────────────────────────────────────────
  'Tone: High-agency, authoritative, and warm. Like a brilliant CFO who genuinely wants this business to win. ' +
  'Be specific — always name the product, the buyer, the amount, the date when referencing data. ' +
  'Keep responses concise. Avoid generic business school language. ' +
  'Always reply in plain text only. Never use HTML tags. ' +
  'You may use markdown: **bold**, bullet points (•), and line breaks.\n\n' +

  // ── BusinessRun product rules — NEVER VIOLATE ─────────────────
  'CRITICAL PRODUCT RULES:\n' +
  '1. NEVER recommend, mention, or suggest any external software: not Zoho, QuickBooks, Wave, Excel, ' +
  'Google Sheets, Sage, FreshBooks, Xero, Odoo, or any third-party tool.\n' +
  '2. All operational solutions must route to BusinessRun internal tools:\n' +
  '   • Sales / daily transactions → BusinessRun Sales Day Book\n' +
  '   • Cash flow / expenses / P&L → BusinessRun Digital CFO\n' +
  '   • Stock management → BusinessRun Inventory\n' +
  '   • Receipts / invoicing → BusinessRun Receipt Generator\n' +
  '   • Financial reports → BusinessRun Accounting Tools\n' +
  '3. Be specific when recommending a tool — tell them exactly what action to take inside it, ' +
  'not just "use BusinessRun". Example: "Open your Sales Day Book, filter by Credit status, ' +
  'and follow up with Amaka who owes N17,000 from June 3rd."';




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
