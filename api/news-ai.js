export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
  try {
    const bodyIn = req.body || {};
    if (bodyIn.mode === 'translate_ui') {
      const language = String(bodyIn.language || 'en');
      const languageName = String(bodyIn.languageName || language);
      const sources = Array.isArray(bodyIn.sources) ? bodyIn.sources.map(x => String(x)).filter(Boolean).slice(0, 35) : [];
      if (!sources.length) return res.status(400).json({ error: 'No UI strings supplied' });
      const prompt = [
        'You are the GBK News UI localization engine.',
        'Translate every supplied English UI string into the requested language.',
        'Language code: ' + language + '.',
        'Language name: ' + languageName + '.',
        'Return ONLY a valid JSON object mapping each original string to its translation.',
        'Keep emojis, numbers, arrows, punctuation, brand names such as GBK News and GBK AI, and URLs unchanged.',
        'Do not summarize, merge, omit, or add keys. Preserve the meaning and make wording natural for a mobile news app. Keep translations concise so the JSON stays complete.',
        'Strings: ' + JSON.stringify(sources)
      ].join('\n');
      const model = process.env.OPENAI_NEWS_MODEL || 'gpt-5.6-luna';
      const r = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ model, input: prompt, max_output_tokens: 3500 })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return res.status(r.status || 502).json({ error: data?.error?.message || 'UI translation request failed' });
      let text = data.output_text;
      if (!text && Array.isArray(data.output)) text = data.output.flatMap(x => Array.isArray(x.content) ? x.content : []).filter(x => x.type === 'output_text' && x.text).map(x => x.text).join('\n');
      if (!text) return res.status(502).json({ error: 'No UI translation returned' });
      text = String(text).trim().replace(/^```json\s*/i,'').replace(/\s*```$/,'');
      let translations;
      try { translations = JSON.parse(text); } catch (e) { return res.status(502).json({ error: 'Invalid UI translation JSON returned' }); }
      return res.status(200).json({ translations });
    }

    const { question, country, language, article } = bodyIn;
    const q = String(question || '').trim();
    if (!q) return res.status(400).json({ error: 'Question is required' });

    const prompt = [
      'You are GBK News AI, the news-analysis assistant for news.gbkai.com.',
      'Answer only news, current-events, public-interest, economics, markets, science/technology, climate, policy, or country-related questions.',
      'Use current web sources for factual claims when available. Clearly distinguish confirmed reporting from analysis or uncertainty.',
      'Return clean plain text for a mobile news app. Do NOT use Markdown headings, # symbols, bullet-star Markdown, HTML, or raw URLs.',
      'Do NOT print full source URLs. Use only short source names in a final Sources line.',
      'Give a COMPLETE answer. Do not stop mid-sentence or omit important current developments because of brevity.',
      'Use this structure: What happened; Why it matters; Who is affected; What happens next; Solutions/actions; What is improving when relevant; Sources.',
      'Keep sections concise and readable on a phone, but finish every section and sentence before ending.',
      'Answer in the selected language code: ' + String(language || 'en') + '.',
      'Selected country: ' + String(country || 'India') + '. Prioritize relevant developments from this country when the question is country-specific.',
      'Current page context: ' + String(article || 'GBK News') + '.',
      'User question: ' + q
    ].join('\n');

    const model = process.env.OPENAI_NEWS_MODEL || 'gpt-5.6-luna';
    const body = { model, tools: [{ type: 'web_search' }], input: prompt, max_output_tokens: 1600 };

    let r, data;
    for (let attempt = 0; attempt < 3; attempt++) {
      r = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify(body)
      });
      data = await r.json().catch(() => ({}));
      if (r.ok) break;
      const code = data?.error?.code || '';
      const type = data?.error?.type || '';
      const retryable = r.status === 429 &&
        !['insufficient_quota','credit_balance_exhausted','organization_usage_limit_exceeded','organization_spend_limit_exceeded','project_spend_limit_exceeded'].includes(code) &&
        type !== 'insufficient_quota';
      if (!retryable || attempt === 2) break;
      const retryAfter = Number(r.headers.get('retry-after'));
      const delay = Number.isFinite(retryAfter) && retryAfter >= 0 ? Math.min(retryAfter * 1000, 8000) : Math.min(1000 * (2 ** attempt), 8000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    if (!r?.ok) return res.status(r?.status || 502).json({
      error: data?.error?.message || 'OpenAI request failed',
      code: data?.error?.code || data?.error?.type || '',
      model
    });

    let answer = data.output_text;
    if (!answer && Array.isArray(data.output)) {
      answer = data.output.flatMap(x => Array.isArray(x.content) ? x.content : [])
        .filter(x => x.type === 'output_text' && x.text)
        .map(x => x.text)
        .join('\n');
    }
    if (!answer) return res.status(502).json({ error: 'No text answer returned' });
    return res.status(200).json({ answer: String(answer).trim() });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
}
