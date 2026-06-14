// SafeWheels Rentals SWFL — vehicle availability checker (Vercel serverless function)
//
// GET /api/availability?start=<ISO>&end=<ISO>&location=<text>
// Cross-references the public "Reservations" Google Calendar iCal feed and
// returns which fleet vehicles are free for the requested window. Guests cannot
// search a start time earlier than 12 hours from now.
//
// Optional env var:
//   CAL_ICS_URL — override the iCal feed URL (defaults to the public feed below)

const CAL_ICS_URL = process.env.CAL_ICS_URL ||
  "https://calendar.google.com/calendar/ical/safewheelsrentals%40gmail.com/public/basic.ics";

const FLEET = [
  { name: "Kia Telluride 2021",     type: "SUV",         seats: "7–8", rate: 80 },
  { name: "Nissan Pathfinder 2025", type: "SUV",         seats: "7",   rate: 65 },
  { name: "Hyundai Santa Fe 2025",  type: "SUV",         seats: "5",   rate: 55 },
  { name: "Chevrolet Traverse 2019",type: "SUV",         seats: "7–8", rate: 55 },
  { name: "Jeep Wrangler 2025",     type: "SUV",         seats: "4–5", rate: 70 },
  { name: "Hyundai Kona 2021",      type: "Compact SUV", seats: "5",   rate: 45 },
  { name: "Kia K4 2025",            type: "Sedan",       seats: "5",   rate: 45 },
  { name: "Hyundai Elantra 2024",   type: "Sedan",       seats: "5",   rate: 45 },
  { name: "Nissan Sentra 2025",     type: "Sedan",       seats: "5",   rate: 45 },
];

const TURO = "https://turo.com/us/en/drivers/795431";
const MIN_LEAD_MS = 12 * 60 * 60 * 1000; // 12 hours

// --- pure, testable helpers ---------------------------------------------------

function validateWindow(startStr, endStr, nowMs) {
  if (!startStr || !endStr) return { ok: false, error: "Please choose a start and end time." };
  const s = new Date(startStr).getTime();
  const e = new Date(endStr).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return { ok: false, error: "Those dates don't look valid." };
  const earliest = nowMs + MIN_LEAD_MS;
  if (s < earliest) {
    return { ok: false, error: "Reservations must start at least 12 hours from now.",
             earliest: new Date(earliest).toISOString() };
  }
  if (e <= s) return { ok: false, error: "The end time must be after the start time." };
  return { ok: true, s, e };
}

function unescapeICS(s) {
  return s.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function parseICSDate(val) {
  if (/^\d{8}$/.test(val)) {                              // all-day: YYYYMMDD
    return Date.parse(`${val.slice(0,4)}-${val.slice(4,6)}-${val.slice(6,8)}T00:00:00Z`);
  }
  const m = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return NaN;                                     // public Google feed uses UTC ("Z")
  return Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
}

function parseICS(text) {
  const unfolded = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const out = [];
  let cur = null;
  for (const line of unfolded.split(/\r?\n/)) {
    if (line === "BEGIN:VEVENT") { cur = {}; continue; }
    if (line === "END:VEVENT") { if (cur) out.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).split(";")[0].toUpperCase();
    const val = line.slice(i + 1);
    if (key === "DTSTART") cur.startMs = parseICSDate(val);
    else if (key === "DTEND") cur.endMs = parseICSDate(val);
    else if (key === "SUMMARY") cur.summary = unescapeICS(val);
    else if (key === "STATUS") cur.status = val.trim().toLowerCase();
  }
  return out
    .filter((e) => !Number.isNaN(e.startMs) && !Number.isNaN(e.endMs))
    .map((e) => ({ status: e.status === "cancelled" ? "cancelled" : "confirmed",
                   summary: e.summary || "", startMs: e.startMs, endMs: e.endMs }));
}

function vehicleFromTitle(title) {
  for (const f of FLEET) if (title && title.includes(f.name)) return f.name;
  return null;
}

// events: [{status, summary, startMs, endMs}]
function computeAvailability(events, sMs, eMs) {
  const booked = new Set();
  for (const ev of events) {
    if (ev.status === "cancelled") continue;
    if (ev.startMs < eMs && ev.endMs > sMs) {             // overlaps requested window
      const v = vehicleFromTitle(ev.summary);
      if (v) booked.add(v);
    }
  }
  const available = FLEET.filter((f) => !booked.has(f.name)).map((f) => ({ ...f, book: TURO }));
  const unavailable = FLEET.filter((f) => booked.has(f.name)).map((f) => f.name);
  return { available, unavailable };
}

// --- HTTP handler -------------------------------------------------------------

async function handler(req, res) {
  try {
    const params = req.query && Object.keys(req.query).length
      ? req.query
      : Object.fromEntries(new URL(req.url, "http://x").searchParams);

    const v = validateWindow(params.start, params.end, Date.now());
    if (!v.ok) return json(res, 400, { error: v.error, earliest: v.earliest });

    const r = await fetch(CAL_ICS_URL, { headers: { "User-Agent": "SafeWheels-Availability" } });
    if (!r.ok) return json(res, 502, { error: "Couldn't reach the calendar. Please try again." });
    const ics = await r.text();

    const events = parseICS(ics);
    const { available, unavailable } = computeAvailability(events, v.s, v.e);

    return json(res, 200, {
      start: new Date(v.s).toISOString(),
      end: new Date(v.e).toISOString(),
      location: params.location || "",
      available, unavailable,
    });
  } catch (err) {
    return json(res, 500, { error: "Something went wrong. Please try again." });
  }
}

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

module.exports = handler;
Object.assign(module.exports, {
  validateWindow, parseICS, parseICSDate, computeAvailability, vehicleFromTitle, FLEET,
});
