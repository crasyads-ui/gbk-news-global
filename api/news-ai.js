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
      'Use current web sources for factual claims. Clearly distinguish confirmed reporting from analysis or uncertainty.',
      'Be concise and useful. Prefer: What happened; Why it matters; Who is affected; What happens next; Solutions/actions; What is improving, when relevant.',
      `Answer in the selected language code: ${String(language || 'en')}.`,
      `Selected country: ${String(country || 'India')}.`,
      `Current page story context: ${String(article || 'GBK News')}.`,
      `User question: ${q}`
    ].join('\n');

    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_NEWS_MODEL || 'gpt-5-mini'
        tools: [{ type: 'web_search' }],
        input: prompt,
        max_output_tokens: 900
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || 'OpenAI request failed' });
    let answer = data.output_text;
    if (!answer && Array.isArray(data.output)) {
      answer = data.output.flatMap(x => Array.isArray(x.content) ? x.content : [])
        .filter(x => x.type === 'output_text' && x.text).map(x => x.text).join('\n');
    }
    if (!answer) return res.status(502).json({ error: 'No text answer returned' });
    return res.status(200).json({ answer });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
}
