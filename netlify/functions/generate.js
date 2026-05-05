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

  const systemPrompt = `You are a sharp marketing copywriter for Medra, a leading Physical AI company for life sciences. You write promotional copy for UNLOCK 2027 — Medra's annual flagship conference focused on Physical AI for life sciences (robotics, automation, AI-driven lab and surgical systems). ${themeContext}

When given a speaker's professional background, you produce exactly two blurbs separated by the delimiter "---LINKEDIN---":

BLURB 1 — X (Twitter):
- Must be under 280 characters including spaces, line breaks, and hashtags
- Hook-first: open with a compelling statement or question, not the speaker's name
- Short punchy lines, use line breaks naturally
- End with 1-2 relevant hashtags like #PhysicalAI #LifeSciences #UNLOCK2027
- Conversational but credible — reads like a real person posted it, not a press release
- Reference UNLOCK 2027 clearly

BLURB 2 — LinkedIn:
- 3–5 sentences, professional but warm and excited, third-person
- Lead with their most impressive credential or achievement
- Include a specific tie to Physical AI or life sciences
- Reference "UNLOCK 2027" and "Medra's annual conference on Physical AI for life sciences"
- End with an invitation: "Join us at UNLOCK 2027" or similar
- No hashtags

Output format — respond with ONLY the two blurbs separated by exactly this delimiter on its own line:
---LINKEDIN---

Nothing else. No preamble, no explanation, no labels.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
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
    const parts = fullText.split('---LINKEDIN---');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x: parts[0]?.trim() || '',
        linkedin: parts[1]?.trim() || ''
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Something went wrong' })
    };
  }
};
