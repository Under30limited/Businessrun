// ================================================================
// functions/advisor.js
// BusinessRun — Strategic AI Advisor (Cloudflare Pages Function)
// ================================================================
// This runs on Cloudflare's edge servers — NOT in the browser.
// The GEMINI_API_KEY environment variable is set in:
//   Cloudflare Dashboard → Pages → your project
//   → Settings → Environment variables → Add variable
//      Key:   GEMINI_API_KEY
//      Value: AIza...
//
// Frontend calls: POST /functions/advisor
// ================================================================

export async function onRequestPost(context) {

  const { request, env } = context;

  // ── CORS headers ──────────────────────────────────────────────
  const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type':                 'application/json',
  };

  // ── Parse request body ────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body' }),
      { status: 400, headers: corsHeaders }
    );
  }

  const { message, history = [] } = body;

  if (!message) {
    return new Response(
      JSON.stringify({ error: 'No message provided' }),
      { status: 400, headers: corsHeaders }
    );
  }

  // ── Read API key from Cloudflare environment variable ─────────
  // Set in: Cloudflare Dashboard → Pages → your project
  //         → Settings → Environment variables
  //   Key:   GEMINI_API_KEY
  //   Value: AIza...  (from aistudio.google.com → Get API Key)
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: 'GEMINI_API_KEY not set. Add it in Cloudflare Dashboard → Pages → Settings → Environment variables.',
      }),
      { status: 500, headers: corsHeaders }
    );
  }

  // ── System prompt ─────────────────────────────────────────────
  const systemPrompt =
    'You are the "TBR Strategic AI Advisor" for BusinessRun, a platform for African founders. ' +
    'Help African business owners register, grow and scale their businesses. ' +
    'Tone: High-agency, professional, actionable. Keep responses concise and practical. ' +
    'Topics: CAC registration, Nigerian tax law, go-to-market strategy, fundraising, ' +
    'fintech, AfCFTA, e-commerce, brand building, pricing, hiring.';

  // ── Build Gemini conversation ─────────────────────────────────
  // Gemini uses 'user' and 'model' roles (not 'assistant')
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

    const data = await geminiRes.json();

    if (data.error) {
      return new Response(
        JSON.stringify({ error: 'Gemini error: ' + data.error.message }),
        { status: 502, headers: corsHeaders }
      );
    }

    const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText) {
      return new Response(
        JSON.stringify({ error: 'No text returned from Gemini' }),
        { status: 502, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ text: aiText }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Function error: ' + err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// ── Handle OPTIONS preflight ──────────────────────────────────────
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
