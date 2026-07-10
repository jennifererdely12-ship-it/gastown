// POST /api/schedule — book an appointment slot.
//
// Validates the slot against the live availability computation (so stale or
// fabricated slot keys are rejected), writes the appointment keyed by the
// slot string (double bookings fail because the key already exists), updates
// the lead record, logs the booking, and emails a confirmation when the
// visitor gave an email address and RESEND_API_KEY is configured.

import { isValidSlot } from './lib/slots.mjs';
import { bookAppointment, bookedSlotKeys, upsertLead, log } from './lib/store.mjs';
import { sendEmail, confirmationEmail } from './lib/email.mjs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(v, max = 200) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const sessionId = clean(body.sessionId, 64);
  const slot = clean(body.slot, 32);
  const name = clean(body.name, 120);
  const phone = clean(body.phone, 40);
  const email = clean(body.email, 200);
  const service = clean(body.service, 200);
  const slotLabel = clean(body.slotLabel, 80);

  if (!name || !phone) return json({ error: 'Name and phone number are required.' }, 400);
  if (email && !EMAIL_RE.test(email)) return json({ error: 'That email address looks invalid.' }, 400);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(slot)) return json({ error: 'Malformed slot.' }, 400);

  const booked = await bookedSlotKeys();
  if (!isValidSlot(slot, booked)) {
    return json({ error: 'That time was just taken — please pick another slot.' }, 409);
  }

  const record = { name, phone, email, service, sessionId, slotLabel };
  const ok = await bookAppointment(slot, record);
  if (!ok) {
    return json({ error: 'That time was just taken — please pick another slot.' }, 409);
  }

  if (sessionId) {
    await upsertLead(sessionId, {
      name,
      phone,
      email,
      service,
      appointmentSlot: slot,
      status: 'booked',
    });
  }
  await log('appointment', { sessionId, slot, name, phone, email, service });

  let confirmationSent = false;
  if (email) {
    const msg = confirmationEmail({ ...record, slot });
    const result = await sendEmail({ to: email, ...msg });
    confirmationSent = result.ok === true;
    await log(result.ok ? 'email' : 'error', {
      source: 'confirmation',
      to: email,
      slot,
      ...(result.ok ? { id: result.id } : { reason: result.reason, skipped: !!result.skipped }),
    });
  }

  return json({ ok: true, slot, confirmationSent });
};
