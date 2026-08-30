GBK GLOBAL NEWS V23 — REAL NEWS AI FIXED

Frontend:
- Search highlights loaded News stories.
- Ask GBK AI stays on news.gbkai.com.
- Voice input feeds the same News AI flow.
- Country and language are sent with each AI request.

Vercel setup:
1. Deploy this folder/project to Vercel.
2. In Vercel Project Settings → Environment Variables, set OPENAI_API_KEY for Production.
3. Optional: set OPENAI_NEWS_MODEL. Default: gpt-5.6-luna.
4. Redeploy after changing environment variables.

The API route now:
- Uses the Responses API with current web search.
- Retries temporary 429 rate-limit responses with bounded backoff.
- Does not waste retries on billing/quota/spend-limit 429 errors.
- Returns the OpenAI error code to the frontend so the real cause is visible.

Security:
- Never put OPENAI_API_KEY in index.html or client-side JavaScript.
- The key is used only by /api/news-ai.js.
