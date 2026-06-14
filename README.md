# SafeWheels Rentals SWFL — Website

Static marketing site + a serverless availability checker for **SafeWheels Rentals SWFL**,
a Southwest Florida car-rental business operating through Turo.

**Live:** https://safewheelsrentalsswfl.com · **Book:** https://turo.com/us/en/drivers/795431

## Structure
- `*.html` — pages (home, about, rental terms, cancellation, guest incident procedure, privacy, blog + articles, availability)
- `styles.css` — shared styles (brand: charcoal + gold)
- `img/` — logo and fleet photos
- `api/availability.js` — Vercel serverless function. Reads the public Reservations
  Google Calendar iCal feed and returns which vehicles are free for a requested
  window. Guests cannot search a start time earlier than 12 hours from now.
- `dev-server.js` — local dev server (`node dev-server.js` → http://localhost:3000)
- `api/_test.js` — unit tests for the availability logic (`node api/_test.js`)

## Deploys
Hosted on Vercel. Pushes to `main` auto-deploy to production.

Vehicle availability is keyed off calendar event titles in the form
`🚗 <Vehicle> — <Guest> · #<ReservationID>`.
