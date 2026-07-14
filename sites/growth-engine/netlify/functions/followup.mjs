// Scheduled promotional follow-up (runs hourly — see `config.schedule`).
//
// Finds chat leads that shared an email address, are at least
// `email.followUpDelayHours` old, and haven't been emailed yet, then sends
// the promotional offer from business.config.json via Resend and stamps the
// lead so it's never emailed twice. Leads that already booked get skipped —
// they receive a confirmation email at booking time instead.

import biz from '../../business.config.json';
import { listByPrefix, upsertLead, log } from './lib/store.mjs';
import { sendEmail, promoEmail } from './lib/email.mjs';

export default async () => {
  const delayMs = (biz.email.followUpDelayHours || 24) * 3600 * 1000;
  const now = Date.now();

  const leads = await listByPrefix('leads/', 500);
  const due = leads.filter(
    (l) =>
      l.email &&
      !l.followUpSentAt &&
      l.status !== 'booked' &&
      l.createdAt &&
      now - Date.parse(l.createdAt) >= delayMs
  );

  let sent = 0;
  let failed = 0;
  for (const lead of due) {
    const msg = promoEmail(lead);
    const result = await sendEmail({ to: lead.email, ...msg });
    if (result.ok) {
      sent++;
      await upsertLead(lead.sessionId, { followUpSentAt: new Date().toISOString() });
      await log('email', { source: 'promo-followup', to: lead.email, sessionId: lead.sessionId, id: result.id });
    } else if (result.skipped) {
      // No RESEND_API_KEY — leave leads unstamped so they send once email is configured.
      await log('error', { source: 'promo-followup', reason: result.reason });
      break;
    } else {
      failed++;
      await log('error', { source: 'promo-followup', to: lead.email, reason: result.reason });
    }
  }

  await log('followup-run', { checked: leads.length, due: due.length, sent, failed });
  return new Response(JSON.stringify({ checked: leads.length, due: due.length, sent, failed }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { schedule: '@hourly' };
