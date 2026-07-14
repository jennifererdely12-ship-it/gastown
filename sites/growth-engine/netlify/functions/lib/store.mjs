// Persistence + activity log, backed by Netlify Blobs.
//
// Key layout inside the single "growth-engine" store:
//   logs/<ISO timestamp>-<rand>   one JSON entry per event (chat, lead, booking, email…)
//   leads/<sessionId>             one JSON record per chat visitor, merged as info arrives
//   appointments/<slotKey>        one JSON record per booked slot; the slot string IS the
//                                 key, so a slot can only be written once.
//
// Every write is best-effort: a Blobs outage must never take the chat widget down,
// so callers get a boolean/null back instead of a thrown error.

import { getStore } from '@netlify/blobs';

const STORE_NAME = 'growth-engine';

function store() {
  return getStore(STORE_NAME);
}

export async function log(type, data = {}) {
  const entry = {
    type,
    at: new Date().toISOString(),
    ...data,
  };
  try {
    const key = `logs/${entry.at}-${Math.random().toString(36).slice(2, 8)}`;
    await store().setJSON(key, entry);
  } catch (err) {
    console.error('[growth-engine] log write failed:', err.message, JSON.stringify(entry));
  }
  return entry;
}

export async function getLead(sessionId) {
  try {
    return await store().get(`leads/${sessionId}`, { type: 'json' });
  } catch {
    return null;
  }
}

// Merge non-empty fields into the lead record for this chat session.
export async function upsertLead(sessionId, fields) {
  try {
    const existing = (await getLead(sessionId)) || {
      sessionId,
      createdAt: new Date().toISOString(),
    };
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined && v !== null && v !== '') existing[k] = v;
    }
    existing.updatedAt = new Date().toISOString();
    await store().setJSON(`leads/${sessionId}`, existing);
    return existing;
  } catch (err) {
    console.error('[growth-engine] lead write failed:', err.message);
    return null;
  }
}

export async function listByPrefix(prefix, limit = 200) {
  const s = store();
  const { blobs } = await s.list({ prefix });
  // Blob keys sort lexicographically; log/lead keys embed ISO timestamps,
  // so newest entries are the highest keys.
  const keys = blobs.map((b) => b.key).sort().reverse().slice(0, limit);
  const items = await Promise.all(
    keys.map(async (key) => {
      try {
        return await s.get(key, { type: 'json' });
      } catch {
        return null;
      }
    })
  );
  return items.filter(Boolean);
}

export async function getAppointment(slotKey) {
  try {
    return await store().get(`appointments/${slotKey}`, { type: 'json' });
  } catch {
    return null;
  }
}

// Returns false if the slot is already taken.
export async function bookAppointment(slotKey, record) {
  const s = store();
  if (await getAppointment(slotKey)) return false;
  await s.setJSON(`appointments/${slotKey}`, {
    slot: slotKey,
    createdAt: new Date().toISOString(),
    ...record,
  });
  return true;
}

export async function bookedSlotKeys() {
  try {
    const { blobs } = await store().list({ prefix: 'appointments/' });
    return new Set(blobs.map((b) => b.key.slice('appointments/'.length)));
  } catch {
    return new Set();
  }
}
