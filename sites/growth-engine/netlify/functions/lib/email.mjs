// Outbound email via the Resend API (https://resend.com).
//
// The API key lives in the RESEND_API_KEY environment variable — never in
// this repo. When the key is missing (e.g. local dev), sends are skipped and
// reported as such so callers can log the skip instead of failing.

import config from '../../../business.config.json';

const RESEND_URL = 'https://api.resend.com/emails';

export async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, skipped: true, reason: 'RESEND_API_KEY not configured' };
  }
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: `${config.email.fromName} <${config.email.fromAddress}>`,
        reply_to: config.email.replyTo,
        to: [to],
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, skipped: false, reason: `Resend ${res.status}: ${body.slice(0, 300)}` };
    }
    const data = await res.json();
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, skipped: false, reason: err.message };
  }
}

function esc(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function shell(title, inner) {
  const biz = config.business;
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
      <tr><td style="background:#1d4ed8;padding:20px 32px;color:#ffffff;font-size:20px;font-weight:bold;">${esc(biz.name)}</td></tr>
      <tr><td style="padding:28px 32px;color:#1f2937;font-size:15px;line-height:1.6;">
        <h1 style="margin:0 0 12px;font-size:22px;color:#111827;">${esc(title)}</h1>
        ${inner}
      </td></tr>
      <tr><td style="padding:18px 32px;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.5;">
        ${esc(biz.name)} · ${esc(biz.address.street)}, ${esc(biz.address.city)}, ${esc(biz.address.state)} ${esc(biz.address.zip)}<br>
        ${esc(biz.phone)} · You received this because you contacted us at ${esc(biz.url)}.
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

export function promoEmail(lead) {
  const promo = config.email.promo;
  const greeting = lead.name ? `Hi ${esc(lead.name)},` : 'Hi there,';
  const html = shell(
    promo.headline,
    `<p>${greeting}</p>
     <p>${esc(promo.body)}</p>
     <p style="text-align:center;margin:24px 0;">
       <a href="${esc(promo.ctaUrl)}" style="background:#1d4ed8;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;display:inline-block;">${esc(promo.cta)}</a>
     </p>
     <p style="color:#6b7280;font-size:13px;">Offer code: <strong>${esc(promo.offerCode)}</strong></p>`
  );
  const text = `${lead.name ? `Hi ${lead.name},` : 'Hi there,'}\n\n${promo.body}\n\n${promo.cta}: ${promo.ctaUrl}\nOffer code: ${promo.offerCode}`;
  return { subject: promo.subject, html, text };
}

export function confirmationEmail(appt) {
  const biz = config.business;
  const when = `${appt.slotLabel || appt.slot}`;
  const html = shell(
    'Your appointment is booked',
    `<p>Hi ${esc(appt.name)},</p>
     <p>You're confirmed for <strong>${esc(when)}</strong>${appt.service ? ` — ${esc(appt.service)}` : ''}.</p>
     <p>We'll call ${esc(appt.phone)} if anything changes. Need to reschedule? Call us at ${esc(biz.phone)}.</p>`
  );
  const text = `Hi ${appt.name},\n\nYou're confirmed for ${when}${appt.service ? ` — ${appt.service}` : ''}.\nNeed to reschedule? Call ${biz.phone}.`;
  return { subject: `Appointment confirmed — ${biz.name}`, html, text };
}
