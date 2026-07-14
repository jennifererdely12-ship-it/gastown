// Appointment slot generation, driven by the `scheduling` block of
// business.config.json. All math is done in the business's local timezone
// using naive "YYYY-MM-DDTHH:MM" strings — a slot key is exactly that string,
// which keeps storage keys human-readable and comparison lexicographic.

import config from '../../../business.config.json';

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Current date/time expressed in the business's timezone.
function localNowParts(tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    y: Number(get('year')),
    m: Number(get('month')),
    d: Number(get('day')),
    hh: Number(get('hour')) % 24,
    mm: Number(get('minute')),
  };
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Generate every open slot in the booking window, newest-first excluded set applied.
export function availableSlots(bookedKeys = new Set()) {
  const sched = config.scheduling;
  const now = localNowParts(sched.timezone);
  // Naive-local cutoff: bookings must be at least minLeadHours away.
  const cutoffUtcMs =
    Date.UTC(now.y, now.m - 1, now.d, now.hh, now.mm) + sched.minLeadHours * 3600 * 1000;

  const openMin = toMinutes(sched.open);
  const closeMin = toMinutes(sched.close);
  const slots = [];

  for (let dayOffset = 0; dayOffset <= sched.maxDaysOut; dayOffset++) {
    // Date.UTC arithmetic on the local calendar date handles month/year rollover.
    const dayMs = Date.UTC(now.y, now.m - 1, now.d + dayOffset);
    const day = new Date(dayMs);
    if (!sched.openDays.includes(day.getUTCDay())) continue;

    const dateStr = `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`;
    for (let min = openMin; min + sched.slotMinutes <= closeMin; min += sched.slotMinutes) {
      const slotUtcMs = dayMs + min * 60 * 1000;
      if (slotUtcMs < cutoffUtcMs) continue;

      const key = `${dateStr}T${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
      if (bookedKeys.has(key)) continue;

      slots.push({
        key,
        date: dateStr,
        time: `${pad(Math.floor(min / 60))}:${pad(min % 60)}`,
        label: new Intl.DateTimeFormat('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        }).format(day),
      });
    }
  }
  return slots;
}

export function isValidSlot(key, bookedKeys = new Set()) {
  return availableSlots(bookedKeys).some((s) => s.key === key);
}
