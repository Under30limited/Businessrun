// ================================================================
// functions/roadmap-insight.js
// BusinessRun — Dynamic Roadmap Insight (Cloudflare Pages Function)
// ================================================================
// Called by RoadmapPage.jsx immediately after the loading screen.
// Passes the user's business profile to Gemini and gets back a
// personalised insight object for the dashboard.
//
// Set GEMINI_API_KEY in:
//   Cloudflare Dashboard → Pages → your project
//   → Settings → Environment variables
// ================================================================

export async function onRequestPost(context) {
  const apiKey = context.env.GEMINI_API_KEY;

  if (!apiKey) {
    return jsonResponse(200, { insight: null, advisorDown: true });
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' });
  }

  const { businessName, stage, salesChannel, revenue, headache } = body;

  if (!businessName || !stage) {
    return jsonResponse(400, { error: 'Missing required fields' });
  }

  const prompt =
    `You are a senior Nigerian business strategist for BusinessRun, a platform for African founders. ` +
    `A founder has just completed their business onboarding. Here is their profile:\n\n` +
    `Business Name: ${businessName}\n` +
    `Stage: ${stage}\n` +
    `Primary Sales Channel: ${salesChannel}\n` +
    `Monthly Revenue Bracket: ${revenue}\n` +
    `Biggest Operational Headache: ${headache}\n\n` +
    `Generate a personalised business roadmap insight in JSON format with exactly these fields:\n` +
    `{\n` +
    `  "prioritySignal": "One punchy, direct sentence (max 20 words) telling this founder their single most important focus right now. Be specific to their stage and channel.",\n` +
    `  "sectorFocus": "3-5 word label for their key business focus area e.g. 'Margin Optimization & Trust'",\n` +
    `  "sectorDetail": "2-3 sentences of honest sector-specific insight. Reference Nigerian market realities. No generic advice.",\n` +
    `  "weeklyAction": "One very specific, actionable task they can do this week. Start with a verb. Max 30 words.",\n` +
    `  "headacheAdvice": "2 sentences directly addressing their stated headache (${headache}). Be practical and specific to Nigeria."\n` +
    `}\n\n` +
    `Return ONLY valid JSON. No markdown, no explanation, no extra fields.`;

  const geminiUrl =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  try {
    const geminiRes = await fetch(geminiUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 512,
          responseMimeType: 'application/json',
        },
      }),
    });

    const rawText = await geminiRes.text();

    let data;
    try { data = JSON.parse(rawText); }
    catch { return jsonResponse(200, { insight: null, advisorDown: true }); }

    if (data.error) {
      return jsonResponse(200, { insight: null, advisorDown: true });
    }

    const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiText || !aiText.trim()) {
      return jsonResponse(200, { insight: null, advisorDown: true });
    }

    let insight;
    try {
      const clean = aiText.replace(/```json|```/g, '').trim();
      insight = JSON.parse(clean);
    } catch {
      return jsonResponse(200, { insight: null, advisorDown: true });
    }

    return jsonResponse(200, { insight });

  } catch {
    return jsonResponse(200, { insight: null, advisorDown: true });
  }
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
