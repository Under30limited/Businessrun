// ================================================================
// netlify/functions/advisor.js
// BusinessRun — Strategic AI Advisor (Netlify Function)
// ================================================================
// This runs on Netlify's servers — NOT in the browser.
// The GEMINI_API_KEY environment variable is set in the
// Netlify dashboard and never exposed to the frontend.
//
// Frontend calls: POST /.netlify/functions/advisor
// ================================================================

exports.handler = async function (event, context) {

  // ── Only allow POST ──────────────────────────────────────────
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // ── Parse request body ───────────────────────────────────────
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON in request body' }),
    };
  }

  const { message, history = [] } = body;

  if (!message) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'No message provided' }),
    };
  }

  // ── Read API key from Netlify environment variable ───────────
  // Set this in: Netlify dashboard → Site settings → Environment variables
  //   Key:   GEMINI_API_KEY
  //   Value: AIza...
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'GEMINI_API_KEY not set. Add it in Netlify dashboard → Site settings → Environment variables.',
      }),
    };
  }

  // ── System prompt ─────────────────────────────────────────────
  const systemPrompt =
    'You are the "TBR Strategic AI Advisor" for BusinessRun, a platform for African founders. ' +
    'Help African business owners register, grow and scale their businesses. ' +
    'Tone: High-agency, professional, actionable. Keep responses concise and practical. ' +
    'Topics: CAC registration, Nigerian tax law, go-to-market strategy, fundraising, ' +
    'fintech, AfCFTA, e-commerce, brand building, pricing, hiring.';

  // ── Build Gemini conversation ─────────────────────────────────
  // Gemini uses 'user' and 'model' roles
  const contents = [
    ...history.map(m => ({
      role:  m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ];

  const geminiUrl =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

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
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'Gemini error: ' + data.error.message }),
      };
    }

    const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'No text returned from Gemini' }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: aiText }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Function error: ' + err.message }),
    };
  }
};
