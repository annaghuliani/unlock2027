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

  try {
    // Step 1: Extract speaker details (name, gender, title, company)
    const extractResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Extract the following from this professional bio and return ONLY a JSON object with no extra text:
{
  "name": "full name",
  "pronouns": "he/him OR she/her OR they/them",
  "title": "current job title",
  "company": "current company",
  "key_achievement": "their single most impressive achievement in one sentence"
}

Bio: ${bio}`
        }]
      })
    });

    const extractData = await extractResponse.json();
    const extractText = extractData.content?.[0]?.text || '';

    let speakerInfo = { name: '', pronouns: 'they/them', title: '', company: '', key_achievement: '' };
    try {
      const cleaned = extractText.replace(/```json|```/g, '').trim();
      speakerInfo = JSON.parse(cleaned);
    } catch (e) {
      // continue with defaults if parsing fails
    }

    // Step 2: Generate blurbs using verified speaker info
    const systemPrompt = `You are a sharp marketing copywriter for Medra, a leading Physical AI company for life sciences. You write promotional copy for UNLOCK 2027 — Medra's annual flagship conference focused on Physical AI for life sciences. ${themeContext}

The speaker's verified details are:
- Name: ${speakerInfo.name}
- Pronouns: ${speakerInfo.pronouns}
- Title: ${speakerInfo.title}
- Company: ${speakerInfo.company}
- Key achievement: ${speakerInfo.key_achievement}

IMPORTANT: Use the correct pronouns (${speakerInfo.pronouns}) consistently throughout both blurbs. Never mix up gender pronouns.

Generate exactly two promotional blurbs and return ONLY a valid JSON object:
{"x": "the X/Twitter blurb here", "linkedin": "the LinkedIn blurb here"}

X blurb rules:
- Under 280 characters
- Hook-first, punchy, 1-2 hashtags like #PhysicalAI #UNLOCK2027
- Reference UNLOCK 2027

LinkedIn blurb rules:
- 3-5 sentences, professional, third-person
- Use correct pronouns throughout
- Reference UNLOCK 2027 and Medra's annual conference on Physical AI for life sciences
- End with an invitation to join

Return ONLY the JSON object, nothing else.`;

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

    let xBlurb = '';
    let linkedinBlurb = '';

    try {
      const cleaned = fullText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      xBlurb = parsed.x || '';
      linkedinBlurb = parsed.linkedin || '';
    } catch (e) {
      const lines = fullText.split('\n\n');
      xBlurb = lines[0]?.trim() || fullText;
      linkedinBlurb = lines[1]?.trim() || fullText;
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x: xBlurb,
        linkedin: linkedinBlurb,
        speaker: speakerInfo
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Something went wrong' })
    };
  }
};
