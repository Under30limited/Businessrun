// ================================================================
// functions/advisor.js
// BusinessRun — Strategic AI Advisor (Cloudflare Pages Function)
// ================================================================
// Cloudflare Pages Functions run on the edge — NOT in the browser.
// The GEMINI_API_KEY environment variable is set in:
//   Cloudflare Dashboard → Pages → your project
//   → Settings → Environment variables
// ================================================================

export async function onRequestPost(context) {

  const apiKey = context.env.GEMINI_API_KEY;

  // ── No API key set ───────────────────────────────────────────
  if (!apiKey) {
    return jsonResponse(200, {
      text: null,
      advisorDown: true,
    });
  }

  // ── Parse request body ───────────────────────────────────────
  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON in request body' });
  }

  const { message, history = [] } = body;

  if (!message) {
    return jsonResponse(400, { error: 'No message provided' });
  }

  // ── System prompt ─────────────────────────────────────────────
  const systemPrompt =
    'You are the "TBR Strategic AI Advisor" for BusinessRun, a platform for African founders. ' +
    'Help African business owners register, grow and scale their businesses. ' +
    'Tone: High-agency, professional, actionable. Keep responses concise and practical. ' +
    'Topics: CAC registration, Nigerian tax law, go-to-market strategy, fundraising, ' +
    'fintech, AfCFTA, e-commerce, brand building, pricing, hiring. ' +
    'IMPORTANT: Always reply in plain text only. Never use HTML tags. ' +
    'You may use markdown such as **bold**, bullet points and line breaks.';

  // ── Build Gemini conversation ─────────────────────────────────
  const contents = [
    ...history.map(m => ({
      role:  m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ];

  const geminiUrl =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;

  // ── Call Gemini ───────────────────────────────────────────────
  try {
    const geminiRes = await fetch(geminiUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig:  { maxOutputTokens: 1024 },
      }),
    });

    // ── Gemini might return non-JSON on network/quota errors ────
    const rawText = await geminiRes.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      // Gemini returned something unparseable (HTML error page, plain text, etc.)
      // Treat as advisor-down rather than crashing
      return jsonResponse(200, { text: null, advisorDown: true });
    }

    // ── Gemini returned a structured error ───────────────────────
    if (data.error) {
      // Surface quota/auth errors as advisor-down, not raw error strings
      return jsonResponse(200, { text: null, advisorDown: true });
    }

    // ── Extract the text from Gemini's response ──────────────────
    let aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    // ── Empty / missing text ─────────────────────────────────────
    if (!aiText || !aiText.trim()) {
      return jsonResponse(200, { text: null, advisorDown: true });
    }

    // ── Sanitise: strip any HTML tags Gemini occasionally returns ─
    aiText = stripHtml(aiText);

    // ── Final empty check after stripping ───────────────────────
    if (!aiText.trim()) {
      return jsonResponse(200, { text: null, advisorDown: true });
    }

    return jsonResponse(200, { text: aiText });

  } catch (err) {
    // Network failure reaching Gemini — treat as advisor-down
    return jsonResponse(200, { text: null, advisorDown: true });
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * stripHtml — converts HTML to readable plain text.
 *
 * Handles the most common patterns Gemini returns:
 *   <br>, <p>, <li>  → newlines
 *   <strong>, <b>    → kept as **text** (markdown bold)
 *   All other tags   → removed
 *   HTML entities    → decoded
 */
function stripHtml(input) {
  return input
    // Block-level tags → newline
    .replace(/<\/p>/gi,   '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi,  '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    // Bold tags → markdown bold
    .replace(/<strong>(.*?)<\/strong>/gis, '**$1**')
    .replace(/<b>(.*?)<\/b>/gis,          '**$1**')
    // Strip all remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse more than 2 consecutive newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
