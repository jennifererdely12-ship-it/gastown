// GET /api/slots — live open appointment slots, computed from the
// scheduling config minus already-booked slots. Consumed by the chat
// widget's slot picker.

import { availableSlots } from './lib/slots.mjs';
import { bookedSlotKeys } from './lib/store.mjs';

export default async (req) => {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  const booked = await bookedSlotKeys();
  const slots = availableSlots(booked);

  // Group by date so the widget can render a day -> times picker.
  const days = [];
  for (const slot of slots) {
    let day = days[days.length - 1];
    if (!day || day.date !== slot.date) {
      day = { date: slot.date, label: slot.label, times: [] };
      days.push(day);
    }
    day.times.push({ key: slot.key, time: slot.time });
  }

  return new Response(JSON.stringify({ days: days.slice(0, 10) }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
