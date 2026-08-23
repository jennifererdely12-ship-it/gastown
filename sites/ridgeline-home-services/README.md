# Ridgeline Home Services — marketing site

Static landing page with an embedded AI chat widget ("Riley") that answers
service questions and captures leads.

**→ New here? Start with [SETUP.md](./SETUP.md)** — a plain-English,
step-by-step guide to getting this live and receiving leads, including how
to re-brand it for a different contractor client.

## Chat widget architecture

The browser **never** holds an Anthropic API key. `index.html` posts the
conversation to `/.netlify/functions/chat`, a serverless function
(`netlify/functions/chat.js`) that:

- reads the key from the `ANTHROPIC_API_KEY` environment variable,
- injects the fixed system prompt (so it can't be overridden from the
  client), and
- forwards the request to `api.anthropic.com` server-side.

Do not move the API key or system prompt back into `index.html` — that
would expose the key to anyone who opens devtools.

## Lead delivery

One path, by design: when Riley learns a visitor's name, phone, and
issue, the browser POSTs the lead as JSON to `LEAD_WEBHOOK_URL` (set near
the top of the `<script>` block in `index.html`). Point that at a
Make.com or Zapier webhook to turn it into a spreadsheet row, email, or
text — see `SETUP.md` step 4 for the exact clicks.

## Files

- `index.html` — the whole site, styles, and chat widget client.
- `netlify/functions/chat.js` — serverless proxy holding the API key and
  system prompt.
- `netlify.toml` — tells Netlify where the function lives.
- `SETUP.md` — non-technical deploy walkthrough.
