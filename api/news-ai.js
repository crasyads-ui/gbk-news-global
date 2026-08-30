export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });

  try {
    const { question, country, language, article } = req.body || {};
    const q = String(question || '').trim();
    if (!q) return res.status(400).json({ error: 'Question is required' });

    const prompt = [
      'You are GBK News AI, a news-analysis assistant embedded in news.gbkai.com.',
      'Answer only news, current-events, public-interest, economics, markets, science/technology, climate, policy, or country-related questions.',
      'Use current web sources for factual claims when available. Clearly distinguish confirmed reporting from analysis or uncertainty.',
      'Be concise and useful. Prefer: What happened; Why it matters; Who is affected; What happens next; Solutions/actions; What is improving, when relevant.',
      `Answer in the selected language code: ${String(language || 'en')}.`,
      `Selected country: ${String(country || 'India')}.`,
      `Current page story context: ${String(article || 'GBK News')}.`,
      `User question: ${q}`
    ].join('\n');

    const model = process.env.OPENAI_NEWS_MODEL || 'gpt-5.6-luna';
    const body = {
      model,
      tools: [{ type: 'web_search' }],
      input: prompt,
      max_output_tokens: 700
    };

    let r;
    let data;
    for (let attempt = 0; attempt < 3; attempt++) {
      r = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify(body)
      });
      data = await r.json().catch(() => ({}));

      if (r.ok) break;
      const code = data?.error?.code || '';
      const type = data?.error?.type || '';
      const retryable = r.status === 429 && ![
        'insufficient_quota',
        'credit_balance_exhausted',
        'organization_usage_limit_exceeded',
        'organization_spend_limit_exceeded',
        'project_spend_limit_exceeded'
      ].includes(code) && type !== 'insufficient_quota';
      if (!retryable || attempt === 2) break;

      const retryAfter = Number(r.headers.get('retry-after'));
      const delay = Number.isFinite(retryAfter) && retryAfter >= 0
        ? Math.min(retryAfter * 1000, 8000)
        : Math.min(1000 * (2 ** attempt), 8000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    if (!r?.ok) {
      const message = data?.error?.message || 'OpenAI request failed';
      const code = data?.error?.code || data?.error?.type || '';
      return res.status(r?.status || 502).json({
        error: message,
        code,
        model
      });
    }

    let answer = data.output_text;
    if (!answer && Array.isArray(data.output)) {
      answer = data.output.flatMap(x => Array.isArray(x.content) ? x.content : [])
        .filter(x => x.type === 'output_text' && x.text)
        .map(x => x.text)
        .join('\n');
    }
    if (!answer) return res.status(502).json({ error: 'No text answer returned' });

    return res.status(200).json({ answer });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
}
