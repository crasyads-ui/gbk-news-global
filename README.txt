GBK GLOBAL NEWS V22 — REAL NEWS AI

Frontend:
- Search highlights loaded News stories.
- Ask GBK AI stays on news.gbkai.com.
- Voice input feeds the same News AI flow.
- Country and language are sent with each AI request.

Vercel setup for live AI:
1. Deploy this folder/project to Vercel.
2. In Vercel Project Settings → Environment Variables, add OPENAI_API_KEY.
3. Optional: add OPENAI_NEWS_MODEL (default: gpt-5.6-luna).
4. Redeploy.

Security:
- Never put OPENAI_API_KEY in index.html or client-side JavaScript.
- The key is used only by /api/news-ai.js.

The News AI endpoint uses current web search through the Responses API, so live-news answers require the server environment variable and an active API account.
