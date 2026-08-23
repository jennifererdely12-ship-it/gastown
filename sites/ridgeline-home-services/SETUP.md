# Setup guide — get this site live and capturing leads

Written for a non-developer. Total time: ~20 minutes. No coding required —
just copy/paste a few values.

You'll need two free accounts: **Netlify** (hosts the site) and either
**Make.com** or **Zapier** (delivers leads to you). Plus an **Anthropic**
account for the chat widget's API key.

---

## 1. Get an Anthropic API key

1. Go to https://console.anthropic.com and sign up / log in.
2. Add a small amount of billing credit (the chat widget costs a fraction
   of a cent per conversation — a few dollars covers hundreds of chats).
3. Go to **API Keys** → **Create Key**. Copy it somewhere safe — you'll
   paste it into Netlify in step 3.

## 2. Deploy the site to Netlify

1. Go to https://app.netlify.com and sign up / log in.
2. Easiest path: drag the whole `ridgeline-home-services` folder onto the
   Netlify dashboard ("Deploy manually" / "Drag and drop your site output
   folder here"). Netlify will give you a live URL in under a minute.
   - If you'd rather deploy from GitHub so you can push updates later,
     use "Import from Git" instead and point it at this folder.
3. Note the site's live URL (e.g. `https://random-name-123.netlify.app`).
   You can rename it under **Site settings → Site details → Change site
   name**, or connect a real domain there too.

## 3. Add your API key to Netlify

1. In your new Netlify site, go to **Site settings → Environment
   variables → Add a variable**.
2. Key: `ANTHROPIC_API_KEY`. Value: the key you copied in step 1.
3. Save, then go to **Deploys** and click **Trigger deploy → Deploy site**
   so the function picks up the new variable.

The chat widget ("Riley") is now live and will answer questions — the key
never appears in the page source, so it's safe to show this site to
anyone.

## 4. Connect lead delivery (Make.com)

This is what gets you a text/email/spreadsheet row every time someone
gives Riley their name, phone, and issue.

1. Go to https://www.make.com and sign up / log in.
2. Create a new scenario. Add a **Webhooks → Custom webhook** module as
   the trigger. Click **Add**, name it anything, and copy the URL it
   gives you.
3. Add whatever you want to happen next — common combo:
   - **Google Sheets → Add a row** (keeps a running list of leads)
   - **Email → Send an email** or **SMS → Send an SMS** (so you get
     pinged immediately)
   Each incoming lead looks like this, so map these fields into your
   sheet/email/text:
   ```json
   {
     "ticketNumber": "#RH-4821",
     "name": "Jane Doe",
     "phone": "303-555-0100",
     "location": "Aurora",
     "issue": "kitchen faucet leaking",
     "urgency": "routine",
     "capturedAt": "8/23/2026, 2:14:00 PM"
   }
   ```
4. Turn the scenario **ON**.
5. Open `index.html` in a text editor, find the line near the top of the
   `<script>` block that says:
   ```js
   const LEAD_WEBHOOK_URL = 'https://hook.us1.make.com/REPLACE_WITH_YOUR_WEBHOOK_URL';
   ```
   and replace the URL with the one Make gave you in step 2.
6. Re-deploy: drag the folder onto Netlify again (or push to GitHub if
   you connected it that way).

Zapier works the same way — use a **Webhooks by Zapier → Catch Hook**
trigger instead of Make's, everything else is identical.

## 5. Test it end to end

1. Open your live Netlify URL. Click **Chat with Dispatch**.
2. Have a short back-and-forth: give a fake name, phone number, and
   issue.
3. Confirm the ticket card in the chat panel fills in as you go.
4. Check your Google Sheet / email / phone for the lead. If nothing
   shows up, check the browser console (right-click → Inspect →
   Console) for `[Riley] Lead webhook failed` and re-check the URL from
   step 4.

You're live.

---

## Re-branding this for a new client

Everything is in one file, `index.html`, plus one small backend file,
`netlify/functions/chat.js`. To spin up a copy for a different
contractor, search each file for these and swap in the new business's
details, then repeat steps 2–4 above on a fresh Netlify site:

| What | Where |
|---|---|
| Business name, tagline | `index.html` — `<title>`, header logo, hero `<h1>` |
| Phone number | `index.html` — hero CTA (`tel:` link), trust bar, footer, chat fallback messages |
| Address, license #, hours, email | `index.html` — footer |
| Service area chips | `index.html` — `#area` section |
| Services offered | `index.html` — `#services` cards |
| Everything the chat assistant is allowed to say (hours, pricing, services, service area) | `netlify/functions/chat.js` — `SYSTEM_PROMPT` |

Keep the business facts in `index.html` and `SYSTEM_PROMPT` in sync —
if a client's hours or pricing change, update both.
