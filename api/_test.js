// Local logic test for availability.js (run: node api/_test.js)
const a = require("./availability.js");
let pass = 0, fail = 0;
const ok = (c, m) => (c ? pass++ : (fail++, console.log("FAIL:", m)));

// --- 12-hour rule + window validation ---
const now = Date.parse("2026-06-14T12:00:00Z");
ok(!a.validateWindow("2026-06-14T20:00:00Z", "2026-06-15T20:00:00Z", now).ok, "rejects start <12h away");
ok(/12 hours/.test(a.validateWindow("2026-06-14T20:00:00Z", "2026-06-15T20:00:00Z", now).error), "12h message");
ok(a.validateWindow("2026-06-15T02:00:00Z", "2026-06-16T02:00:00Z", now).ok, "accepts start >=12h away");
ok(!a.validateWindow("2026-06-16T02:00:00Z", "2026-06-16T01:00:00Z", now).ok, "rejects end<=start");
ok(!a.validateWindow("", "", now).ok, "rejects missing");

// --- ICS parse + availability ---
const ics = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT", "SUMMARY:🚗 Nissan Sentra 2025 — Tamazine G. · #57579514", "DTSTART:20260621T033000Z", "DTEND:20260626T233000Z", "STATUS:CONFIRMED", "END:VEVENT",
  "BEGIN:VEVENT", "SUMMARY:🚗 Kia Telluride 2021 — Megan H. · #56514989", "DTSTART:20260615T193000Z", "DTEND:20260622T150000Z", "STATUS:CONFIRMED", "END:VEVENT",
  "BEGIN:VEVENT", "SUMMARY:🚗 Jeep Wrangler 2025 — Someone X · #999", "DTSTART:20260620T100000Z", "DTEND:20260622T100000Z", "STATUS:CANCELLED", "END:VEVENT",
  "BEGIN:VEVENT", "SUMMARY:Car rental drop-off: Turo", "DTSTART:20250915T200000Z", "DTEND:20250915T210000Z", "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");
const evs = a.parseICS(ics);
ok(evs.length === 4, "parsed 4 events, got " + evs.length);

// Window Jun 16–18: only Telluride overlaps
let r = a.computeAvailability(evs, Date.parse("2026-06-16T15:00:00Z"), Date.parse("2026-06-18T15:00:00Z"));
ok(r.unavailable.includes("Kia Telluride 2021"), "Telluride booked in its window");
ok(!r.unavailable.includes("Nissan Sentra 2025"), "Sentra free outside its window");
ok(!r.unavailable.includes("Jeep Wrangler 2025"), "cancelled event ignored");
ok(r.available.length === 8, "8 available with 1 booked, got " + r.available.length);

// Window Jun 21–22: Sentra + Telluride overlap
let r2 = a.computeAvailability(evs, Date.parse("2026-06-21T12:00:00Z"), Date.parse("2026-06-22T12:00:00Z"));
ok(r2.unavailable.includes("Nissan Sentra 2025") && r2.unavailable.includes("Kia Telluride 2021"), "both booked");
ok(r2.available.length === 7, "7 available with 2 booked, got " + r2.available.length);

// Non-overlapping window (next year): everything free
let r3 = a.computeAvailability(evs, Date.parse("2027-01-01T12:00:00Z"), Date.parse("2027-01-03T12:00:00Z"));
ok(r3.available.length === 9 && r3.unavailable.length === 0, "all 9 free when no overlap");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
