// ================================================================
// functions/accounting.js
// BusinessRun — Accounting Tools AI (Cloudflare Pages Function)
// ================================================================
// Set GEMINI_API_KEY in:
//   Cloudflare Dashboard → Pages → your project
//   → Settings → Environment variables
// ================================================================

export async function onRequestPost(context) {

  const apiKey = context.env.GEMINI_API_KEY;

  if (!apiKey) {
    return jsonResponse(200, { result: null, advisorDown: true });
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON in request body' });
  }

  const { transactions, activeTool } = body;

  if (!transactions || !activeTool) {
    return jsonResponse(400, { error: 'Missing transactions or activeTool' });
  }

  const prompt =
    `You are a professional accountant working with Nigerian SMEs. ` +
    `Analyze this financial data for a ${activeTool} report: ${JSON.stringify(transactions)}. ` +
    `1. Audit for errors (negative balances, missing categories, inconsistencies). ` +
    `2. Calculate totals based on standard accounting principles. ` +
    `3. Provide a clear, actionable strategic insight summary relevant to the Nigerian business context. ` +
    `Output ONLY a valid JSON object with exactly these fields: ` +
    `"audit" (string describing any errors found or "No issues found"), ` +
    `"totals" (object with applicable fields from: revenue, expenses, netIncome, assets, liabilities — only include what is relevant to the report type), ` +
    `"insight" (string with 2-3 sentences of actionable business advice). ` +
    `Do not include any text outside the JSON object.`;

  const geminiUrl =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;

  try {
    const geminiRes = await fetch(geminiUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      }),
    });

    const rawText = await geminiRes.text();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      return jsonResponse(200, { result: null, advisorDown: true });
    }

    if (data.error) {
      return jsonResponse(200, { result: null, advisorDown: true });
    }

    const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText || !aiText.trim()) {
      return jsonResponse(200, { result: null, advisorDown: true });
    }

    // Parse the JSON the AI returned
    let result;
    try {
      const clean = aiText.replace(/```json|```/g, '').trim();
      result = JSON.parse(clean);
    } catch {
      return jsonResponse(200, { result: null, advisorDown: true });
    }

    return jsonResponse(200, { result });

  } catch {
    return jsonResponse(200, { result: null, advisorDown: true });
  }
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
