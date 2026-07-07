# Ridgeline Home Services — marketing site

Static landing page with an embedded AI chat widget ("Riley") that answers
service questions and captures leads.

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

## Deploying (Netlify)

1. Push this directory to a site connected to Netlify (or `netlify deploy`
   from within `sites/ridgeline-home-services/`).
2. In Site settings -> Environment variables, add `ANTHROPIC_API_KEY` with
   a real key. Never commit it to git.
3. `netlify.toml` already points Netlify at `netlify/functions` for the
   function bundle.

## Lead delivery

`CONFIG` at the top of the `<script>` block in `index.html` has two
optional lead-delivery paths, fired once a name + phone + issue are known:

- `makeWebhookUrl` — a make.com webhook (e.g. writes a Google Sheet row and
  sends an email). Replace the placeholder URL.
- `twilioFunctionUrl` — a second Netlify function you write yourself,
  following the same server-side-secret pattern as `chat.js` (hold the
  Twilio credentials as environment variables, never in the browser).
  That function isn't included here; add it before enabling this path, or
  set `enableTwilio: false`.

Both are booleans in `CONFIG` and can be disabled independently.
