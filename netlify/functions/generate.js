exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { bio, themes } = JSON.parse(event.body || '{}');

  if (!bio) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No bio provided' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  const themeContext = themes
    ? `The key themes of UNLOCK 2027 this year are: ${themes}. Weave these themes naturally into the blurbs where relevant.`
    : '';

  const systemPrompt = `You are a sharp marketing copywriter for Medra, a leading Physical AI company for life sciences. You write promotional copy for UNLOCK 2027 — Medra's annual flagship conference focused on Physical AI for life sciences. ${themeContext}

Generate exactly two promotional blurbs for the speaker described by the user.

Format your response as valid JSON like this:
{"x": "the X/Twitter blurb here", "linkedin": "the LinkedIn blurb here"}

X blurb rules:
- Under 280 characters
- Hook-first, punchy, 1-2 hashtags like #PhysicalAI #UNLOCK2027
- Reference UNLOCK 2027

LinkedIn blurb rules:
- 3-5 sentences, professional, third-person
- Reference UNLOCK 2027 and Medra's annual conference on Physical AI for life sciences
- End with an invitation to join

Return ONLY the JSON object, nothing else.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Generate speaker blurbs for UNLOCK 2027 based on this professional background:\n\n${bio}` }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data?.error?.message || 'API error' })
      };
    }

    const fullText = data.content?.[0]?.text || '';
    
    // Parse JSON response
    let xBlurb = '';
    let linkedinBlurb = '';
    
    try {
      const cleaned = fullText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      xBlurb = parsed.x || '';
      linkedinBlurb = parsed.linkedin || '';
    } catch (e) {
      // fallback: split on newlines
      const lines = fullText.split('\n\n');
      xBlurb = lines[0]?.trim() || fullText;
      linkedinBlurb = lines[1]?.trim() || fullText;
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: xBlurb, linkedin: linkedinBlurb })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Something went wrong' })
    };
  }
};
