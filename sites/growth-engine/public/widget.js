// Growth Engine chat widget — drop-in embed.
//
// Add to any page (this site or an existing business website on the same
// Netlify deploy):
//
//   <script src="/widget.js" defer
//           data-business="Apex Plumbing & Heating"
//           data-assistant="Ace"
//           data-accent="#047857"></script>
//
// It answers pricing/service questions via /api/chat, shows live open
// appointment slots from /api/slots when the visitor wants to book, and
// submits bookings to /api/schedule. No API keys live in this file.

(function () {
  'use strict';

  var script = document.currentScript || {};
  var ds = script.dataset || {};
  var BUSINESS = ds.business || 'our team';
  var ASSISTANT = ds.assistant || 'Assistant';
  var ACCENT = ds.accent || '#047857';
  var API_BASE = ds.apiBase || '';

  var sessionId =
    (window.crypto && crypto.randomUUID && crypto.randomUUID()) ||
    'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);

  var history = []; // {role, content} — what we send to /api/chat
  var lead = { name: '', phone: '', email: '' };
  var busy = false;

  /* ---------- styles ---------- */
  var css =
    '.gw-btn{position:fixed;bottom:20px;right:20px;z-index:99990;width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;background:' + ACCENT + ';color:#fff;font-size:26px;box-shadow:0 4px 16px rgba(0,0,0,.25);transition:transform .15s}' +
    '.gw-btn:hover{transform:scale(1.07)}' +
    '.gw-panel{position:fixed;bottom:92px;right:20px;z-index:99991;width:min(370px,calc(100vw - 32px));height:min(540px,calc(100vh - 120px));display:none;flex-direction:column;background:#fff;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.28);overflow:hidden;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
    '.gw-panel.gw-open{display:flex}' +
    '.gw-head{background:' + ACCENT + ';color:#fff;padding:14px 16px;font-size:15px;line-height:1.3}' +
    '.gw-head b{display:block;font-size:16px}' +
    '.gw-msgs{flex:1;overflow-y:auto;padding:14px;background:#f5f7fa;display:flex;flex-direction:column;gap:8px}' +
    '.gw-m{max-width:85%;padding:9px 13px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}' +
    '.gw-m.gw-a{background:#fff;border:1px solid #e3e7ee;align-self:flex-start;border-bottom-left-radius:4px;color:#1f2937}' +
    '.gw-m.gw-u{background:' + ACCENT + ';color:#fff;align-self:flex-end;border-bottom-right-radius:4px}' +
    '.gw-typing{align-self:flex-start;color:#8a93a3;font-size:13px;padding:4px 13px}' +
    '.gw-slots{align-self:stretch;background:#fff;border:1px solid #e3e7ee;border-radius:12px;padding:10px}' +
    '.gw-slots h4{margin:2px 0 8px;font-size:13px;color:#374151}' +
    '.gw-day{margin-bottom:8px}' +
    '.gw-day span{display:block;font-size:12px;font-weight:600;color:#6b7280;margin-bottom:4px}' +
    '.gw-t{display:inline-block;margin:0 6px 6px 0;padding:5px 10px;border:1px solid ' + ACCENT + ';color:' + ACCENT + ';background:#fff;border-radius:16px;font-size:13px;cursor:pointer}' +
    '.gw-t:hover{background:' + ACCENT + ';color:#fff}' +
    '.gw-form{display:flex;flex-direction:column;gap:6px}' +
    '.gw-form input{padding:8px 10px;border:1px solid #d4d9e0;border-radius:8px;font-size:14px}' +
    '.gw-form button{margin-top:2px;padding:9px;border:none;border-radius:8px;background:' + ACCENT + ';color:#fff;font-size:14px;font-weight:600;cursor:pointer}' +
    '.gw-err{color:#b91c1c;font-size:12px;margin:0}' +
    '.gw-input{display:flex;gap:8px;padding:10px;border-top:1px solid #e3e7ee;background:#fff}' +
    '.gw-input textarea{flex:1;resize:none;border:1px solid #d4d9e0;border-radius:10px;padding:9px 12px;font-size:14px;font-family:inherit;height:40px;line-height:20px}' +
    '.gw-input button{border:none;background:' + ACCENT + ';color:#fff;border-radius:10px;padding:0 16px;font-size:14px;font-weight:600;cursor:pointer}' +
    '.gw-input button:disabled{opacity:.5;cursor:default}';
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------- DOM ---------- */
  var btn = document.createElement('button');
  btn.className = 'gw-btn';
  btn.setAttribute('aria-label', 'Open chat');
  btn.textContent = '💬';

  var panel = document.createElement('div');
  panel.className = 'gw-panel';
  panel.innerHTML =
    '<div class="gw-head"><b>' + esc(ASSISTANT) + '</b>' + esc(BUSINESS) + ' — pricing &amp; scheduling</div>' +
    '<div class="gw-msgs" role="log" aria-live="polite"></div>' +
    '<form class="gw-input"><textarea rows="1" placeholder="Ask about pricing or book a visit…" aria-label="Message"></textarea><button type="submit">Send</button></form>';

  document.addEventListener('DOMContentLoaded', mount);
  if (document.readyState !== 'loading') mount();
  var mounted = false;
  function mount() {
    if (mounted) return;
    mounted = true;
    document.body.appendChild(btn);
    document.body.appendChild(panel);
  }

  var msgs = panel.querySelector('.gw-msgs');
  var form = panel.querySelector('.gw-input');
  var input = panel.querySelector('textarea');
  var send = panel.querySelector('.gw-input button');

  btn.addEventListener('click', function () {
    var open = panel.classList.toggle('gw-open');
    btn.textContent = open ? '✕' : '💬';
    if (open && history.length === 0) greet();
    if (open) input.focus();
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    submit();
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  });

  /* ---------- helpers ---------- */
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
  function bubble(role, text) {
    var el = document.createElement('div');
    el.className = 'gw-m ' + (role === 'user' ? 'gw-u' : 'gw-a');
    el.textContent = text;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }
  function typing(on) {
    var t = msgs.querySelector('.gw-typing');
    if (on && !t) {
      t = document.createElement('div');
      t.className = 'gw-typing';
      t.textContent = ASSISTANT + ' is typing…';
      msgs.appendChild(t);
      msgs.scrollTop = msgs.scrollHeight;
    } else if (!on && t) {
      t.remove();
    }
  }

  function greet() {
    var g =
      'Hi! I’m ' + ASSISTANT + ' 👋 I can answer pricing questions and book you an appointment with ' +
      BUSINESS + '. What can I help with?';
    history.push({ role: 'assistant', content: g });
    bubble('assistant', g);
  }

  function submit() {
    var text = input.value.trim();
    if (!text || busy) return;
    input.value = '';
    history.push({ role: 'user', content: text });
    bubble('user', text);
    ask();
  }

  function ask() {
    busy = true;
    send.disabled = true;
    typing(true);
    fetch(API_BASE + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId, messages: history }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        typing(false);
        if (!res.ok || !res.d.reply) {
          bubble('assistant', (res.d && res.d.error) || 'Sorry, something went wrong. Please call us instead.');
          return;
        }
        history.push({ role: 'assistant', content: res.d.reply });
        bubble('assistant', res.d.reply);
        if (res.d.lead) {
          if (res.d.lead.name) lead.name = res.d.lead.name;
          if (res.d.lead.phone) lead.phone = res.d.lead.phone;
          if (res.d.lead.email) lead.email = res.d.lead.email;
        }
        if (res.d.wantsBooking) showSlots();
      })
      .catch(function () {
        typing(false);
        bubble('assistant', 'Sorry, I couldn’t reach the server. Please try again in a moment.');
      })
      .finally(function () {
        busy = false;
        send.disabled = false;
      });
  }

  /* ---------- booking flow ---------- */
  function showSlots() {
    fetch(API_BASE + '/api/slots')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.days || d.days.length === 0) {
          bubble('assistant', 'I don’t see any open slots right now — please call us and we’ll fit you in.');
          return;
        }
        var box = document.createElement('div');
        box.className = 'gw-slots';
        box.innerHTML = '<h4>Pick a time (' + esc(BUSINESS) + ' local time):</h4>';
        d.days.slice(0, 5).forEach(function (day) {
          var dv = document.createElement('div');
          dv.className = 'gw-day';
          dv.innerHTML = '<span>' + esc(day.label) + ' · ' + esc(day.date) + '</span>';
          day.times.slice(0, 6).forEach(function (t) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'gw-t';
            b.textContent = t.time;
            b.addEventListener('click', function () {
              box.remove();
              showBookingForm(t.key, day.label + ' at ' + t.time);
            });
            dv.appendChild(b);
          });
          box.appendChild(dv);
        });
        msgs.appendChild(box);
        msgs.scrollTop = msgs.scrollHeight;
      })
      .catch(function () {
        bubble('assistant', 'I couldn’t load the calendar — please call us to book.');
      });
  }

  function showBookingForm(slotKey, slotLabel) {
    var box = document.createElement('div');
    box.className = 'gw-slots';
    box.innerHTML =
      '<h4>Booking ' + esc(slotLabel) + '</h4>' +
      '<form class="gw-form">' +
      '<input name="name" placeholder="Your name" required value="' + esc(lead.name) + '">' +
      '<input name="phone" type="tel" placeholder="Phone number" required value="' + esc(lead.phone) + '">' +
      '<input name="email" type="email" placeholder="Email (for confirmation + offers)" value="' + esc(lead.email) + '">' +
      '<input name="service" placeholder="What do you need help with?">' +
      '<p class="gw-err" hidden></p>' +
      '<button type="submit">Confirm booking</button>' +
      '</form>';
    msgs.appendChild(box);
    msgs.scrollTop = msgs.scrollHeight;

    var f = box.querySelector('form');
    var err = box.querySelector('.gw-err');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      err.hidden = true;
      var payload = {
        sessionId: sessionId,
        slot: slotKey,
        slotLabel: slotLabel,
        name: f.name.value.trim(),
        phone: f.phone.value.trim(),
        email: f.email.value.trim(),
        service: f.service.value.trim(),
      };
      f.querySelector('button').disabled = true;
      fetch(API_BASE + '/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (res.ok && res.d.ok) {
            box.remove();
            var note =
              'You’re booked for ' + slotLabel + '! ' +
              (res.d.confirmationSent
                ? 'A confirmation email is on its way.'
                : 'We’ll call ' + payload.phone + ' to confirm.');
            history.push({ role: 'assistant', content: note });
            bubble('assistant', note);
          } else {
            f.querySelector('button').disabled = false;
            err.textContent = (res.d && res.d.error) || 'Booking failed — please try another time.';
            err.hidden = false;
            if (res.ok === false && res.d && /taken/.test(res.d.error || '')) {
              box.remove();
              showSlots();
            }
          }
        })
        .catch(function () {
          f.querySelector('button').disabled = false;
          err.textContent = 'Network error — please try again.';
          err.hidden = false;
        });
    });
  }
})();
