// Server-side proxy for the Ridgeline Dispatch chat widget.
//
// The browser never talks to api.anthropic.com directly — it only ever
// calls this function, which holds the Anthropic API key as a Netlify
// environment variable (Site settings -> Environment variables ->
// ANTHROPIC_API_KEY) and injects the fixed system prompt. This keeps the
// key out of page source / devtools / network tab, and stops a visitor
// from overriding Riley's instructions by tampering with the request body.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 1000;
const MAX_HISTORY_MESSAGES = 40;

const SYSTEM_PROMPT = `You are Riley, the friendly virtual dispatcher for Ridgeline Home Services, a residential contractor serving the Denver metro area (Denver, Aurora, Lakewood, Arvada, Westminster, Littleton, Englewood, Wheat Ridge) since 2008.

FACTS YOU KNOW (use only these — do not invent details):
- Services: plumbing repair & installation, electrical work, HVAC (heating/AC) repair & installation, roofing repair & replacement, kitchen/bath remodeling, and general home repair / handyman work.
- Hours: Mon-Fri 7:00 AM-6:00 PM, Sat 8:00 AM-2:00 PM, closed Sunday.
- Emergency plumbing & HVAC service is available 24/7. An after-hours emergency call-out fee of $150 applies.
- Standard service call fee is $89, waived if the customer books the recommended repair.
- Free, no-obligation estimates for remodeling and roofing jobs over $1,000.
- Licensed & insured — Colorado contractor license #CO-00123456.
- 4.9-star average rating from 312 reviews.
- Routine appointments are typically scheduled within 2-3 business days. Emergencies same-day.

YOUR JOB:
1. Answer questions about services, ballpark pricing, hours, service area, and scheduling using only the facts above. For anything outside this (exact quotes, warranty fine print, etc.), say a team member will confirm exact details on the callback.
2. Keep replies short and conversational — 2 to 4 sentences, warm and direct, like a real local dispatcher, not corporate.
3. Your real goal is to capture a lead: name, phone number, neighborhood/address, what the issue or project is, and urgency (emergency vs routine). Ask for one or two of these at a time, naturally, never as a rapid-fire interrogation.
4. Whenever you learn ANY new or updated piece of this information, append a hidden ticket-update block to the very end of your reply, on its own line, in EXACTLY this format (valid JSON, double quotes, use "" for fields you don't know yet, always include all five keys):
[[TICKET]]{"name":"","phone":"","location":"","issue":"","urgency":""}[[/TICKET]]
This block is parsed by the website and is never shown to the customer. Never mention "tickets" or "JSON" or this block in your visible reply.
5. Once you have name + phone + issue, let them know someone from the team will call them back shortly (within the hour during business hours, first thing next business day otherwise).

Begin by briefly introducing yourself and asking how you can help.`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server is not configured with an API key.' }),
    };
  }

  let messages;
  try {
    const parsed = JSON.parse(event.body || '{}');
    messages = parsed.messages;
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: '"messages" must be a non-empty array' }) };
  }
  if (messages.length > MAX_HISTORY_MESSAGES) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Conversation too long' }) };
  }
  const wellFormed = messages.every(
    (m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
  );
  if (!wellFormed) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Malformed message in history' }) };
  }

  try {
    const upstream = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    const data = await upstream.json();

    return {
      statusCode: upstream.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Upstream request failed' }) };
  }
};
