# Growth Engine — get found on Google, convert visitors, follow up automatically

A reusable kit any local business can deploy to grow its customer base:

| Piece | What it does |
|---|---|
| **SEO landing page** (`public/index.html`) | Structured data (LocalBusiness + FAQ schema), keyword-led title/meta, sitemap & robots.txt — everything Google needs to rank and show rich results (stars, prices, FAQ dropdowns). |
| **Chat widget** (`public/widget.js`) | Floating chat on every page. Answers pricing/service questions from your config via Claude, captures name/phone/email, and books real appointment slots. |
| **Appointment scheduling** (`slots.mjs`, `schedule.mjs`) | Live open slots computed from your business hours; bookings are stored, double-bookings rejected, confirmations emailed instantly. |
| **Promotional follow-up email** (`followup.mjs`) | Hourly job that emails a promo offer to every chat lead who shared an email but didn't book, after a configurable delay. Never emails the same lead twice. |
| **Activity logs + dashboard** (`logs.mjs`, `public/admin.html`) | Every chat turn, lead, booking, and email is logged to Netlify Blobs. View it all at `/admin.html` with your admin token. |

Everything is driven by **one file: `business.config.json`** (name, services,
prices, hours, service area, scheduling rules, email copy). The landing page
HTML carries the same facts in its `EDIT ME` block — keep the two in sync.

The sample business ("Bluebird Plumbing & Heating") is fictional placeholder
content. Replace it with your own before deploying.

## Deploy (Netlify)

1. Connect this directory to a Netlify site (base directory
   `sites/growth-engine`) or run `netlify deploy` from here.
2. Set environment variables (Site settings → Environment variables) —
   **never commit these to git**:
   - `ANTHROPIC_API_KEY` — powers the chat assistant.
   - `RESEND_API_KEY` — powers confirmation + promo emails via
     [resend.com](https://resend.com) (verify your sending domain there).
     Without it, chat and booking still work; email sends are skipped and
     logged, and promo follow-ups queue until the key is added.
   - `ADMIN_TOKEN` — any long random string; it's the password for
     `/admin.html` and the `/api/logs` endpoint.
3. Storage needs no setup — leads, appointments, and logs live in
   [Netlify Blobs](https://docs.netlify.com/blobs/overview/), enabled
   automatically on deploy.
4. The follow-up emailer is a Netlify scheduled function (`@hourly`),
   registered automatically from `followup.mjs`.

Local development: `npm install && netlify dev` from this directory
(Netlify Dev emulates functions, blobs, and redirects).

## Getting found on Google — launch checklist

The page is built for this, but Google needs a few signals from you:

1. **Replace every `example.com`** in `index.html`, `robots.txt`, and
   `sitemap.xml` with your real domain, and fill in real business facts.
   Lead the `<title>` with what customers search: *service + city*
   ("Plumber in Portland, OR").
2. **Validate the structured data** at
   <https://search.google.com/test/rich-results>. The JSON-LD blocks are
   what unlock star ratings, price info, and FAQ dropdowns in results.
3. **Google Search Console** (<https://search.google.com/search-console>):
   verify your domain, then submit `sitemap.xml` under Indexing → Sitemaps
   and request indexing of the homepage.
4. **Google Business Profile** (<https://business.google.com>): create/claim
   your listing with the *exact* same name, address, and phone as the site
   (consistent "NAP" is a local-ranking signal), link to your site, and ask
   happy customers for reviews — review count and rating drive the local
   map pack.
5. Keep the FAQ section growing with real questions customers ask (mirror
   each one in the FAQPage JSON-LD). Pages that answer "how much does X
   cost in \<city\>" win those searches.

## Embedding the widget on an existing site

The widget is standalone — add one line to any page served from the same
Netlify site:

```html
<script src="/widget.js" defer
        data-business="Your Business Name"
        data-assistant="Robin"
        data-accent="#1d4ed8"></script>
```

Hosting the page elsewhere? Point `data-api-base` at your Netlify site
origin (e.g. `data-api-base="https://yoursite.netlify.app"`) — and note
you'd then need CORS headers on the functions.

## How a visitor flows through the system

1. Visitor finds the page on Google, opens the chat, asks "how much is a
   water heater?" → `chat.mjs` answers from `business.config.json` pricing
   (`log: chat`).
2. The assistant naturally collects name/phone/email → hidden `[[LEAD]]`
   marker is parsed server-side into a lead record (`log: lead`).
3. Visitor says "can I book Tuesday?" → hidden `[[BOOK]]` marker makes the
   widget show live open slots from `/api/slots`; they pick one and confirm
   → `/api/schedule` stores it and emails a confirmation
   (`log: appointment`, `log: email`).
4. If they gave an email but *didn't* book, the hourly `followup.mjs` job
   sends the promo offer from the config after `followUpDelayHours`
   (`log: email`), stamping the lead so it's one promo per lead, ever.
5. The owner opens `/admin.html`, enters `ADMIN_TOKEN`, and reviews the
   full activity log, lead list, and appointment book.

## Security notes

- The Anthropic key, Resend key, and admin token exist **only** as Netlify
  environment variables. The browser never sees them — don't move them
  into `index.html`/`widget.js`.
- The chat system prompt is fixed server-side; visitors can't override it
  from the request body. History length and message size are capped.
- `/api/logs` requires the bearer token (constant-time comparison) and
  `/admin.html` is `noindex` + disallowed in `robots.txt`.
- All booking inputs are validated and length-capped server-side; slot keys
  are checked against live availability, so stale/fabricated slots are
  rejected.
