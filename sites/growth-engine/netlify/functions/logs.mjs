// GET /api/logs?kind=logs|leads|appointments&limit=N — admin-only activity feed.
//
// Auth: `Authorization: Bearer <ADMIN_TOKEN>` where ADMIN_TOKEN is a Netlify
// environment variable you choose (a long random string). The admin
// dashboard at /admin.html prompts for the token and calls this endpoint.

import { timingSafeEqual } from 'node:crypto';
import { listByPrefix } from './lib/store.mjs';

const KINDS = { logs: 'logs/', leads: 'leads/', appointments: 'appointments/' };

function tokenMatches(header, expected) {
  const supplied = (header || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return json({ error: 'ADMIN_TOKEN is not configured on the server.' }, 500);
  if (!tokenMatches(req.headers.get('authorization'), expected)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const url = new URL(req.url);
  const kind = url.searchParams.get('kind') || 'logs';
  const prefix = KINDS[kind];
  if (!prefix) return json({ error: `kind must be one of: ${Object.keys(KINDS).join(', ')}` }, 400);

  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 500);
  const items = await listByPrefix(prefix, limit);
  return json({ kind, count: items.length, items });
};
