#!/usr/bin/env node
/*
 * build-reviews.js — inject SafeWheels guest reviews into the site.
 *
 * Source of truth: reviews.json (paste real Turo reviews there).
 * Turo blocks scraping, so reviews are maintained by hand in that file.
 *
 * What it does:
 *   1. Builds a styled "Guest Reviews" section (featured reviews as cards).
 *   2. Builds Review + AggregateRating JSON-LD so Google can show star
 *      rich snippets in search results.
 *   3. Replaces the marker regions in each target page:
 *        <!-- REVIEWS:START -->   ... <!-- REVIEWS:END -->     (visible section)
 *        <!-- REVIEWS-LD:START --> ... <!-- REVIEWS-LD:END -->  (JSON-LD, homepage)
 *
 * Run:  node tools/build-reviews.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://safewheelsrentalsswfl.com';
const TURO = 'https://turo.com/us/en/drivers/795431';

// Pages that get the visible reviews section.
const HTML_TARGETS = [
  'index.html',
  'cape-coral-car-rental.html',
  'fort-myers-car-rental.html',
  'naples-car-rental.html',
  'punta-gorda-car-rental.html',
  'pgd-airport-car-rental.html',
  'rsw-airport-car-rental.html',
];
// Pages that get the JSON-LD block (homepage carries the AggregateRating).
const LD_TARGETS = ['index.html'];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stars = (n) => '★★★★★☆☆☆☆☆'.slice(5 - Math.round(n), 10 - Math.round(n));

function replaceRegion(html, tag, inner) {
  const start = `<!-- ${tag}:START -->`;
  const end = `<!-- ${tag}:END -->`;
  const re = new RegExp(`${start}[\\s\\S]*?${end}`);
  if (!re.test(html)) return null; // markers not present on this page
  return html.replace(re, `${start}\n${inner}\n${end}`);
}

function buildSection(data) {
  const featured = data.reviews.filter((r) => r.featured);
  const list = (featured.length ? featured : data.reviews).slice(0, 6);
  if (!list.length) return ''; // nothing to show yet

  const r = data.summary.rating;
  const count = data.summary.reviewCount || data.reviews.length;
  const ratingLine = r
    ? `<div class="reviews-rating"><span class="stars-big">${stars(r)}</span> ${r.toFixed(2)} on Turo · ${count}+ guest ratings</div>`
    : '';

  const cards = list
    .map(
      (rev) => `        <figure class="review-card">
          <div class="review-stars" aria-label="${rev.rating} out of 5 stars">${stars(rev.rating)}</div>
          <blockquote class="review-text">&ldquo;${esc(rev.text)}&rdquo;</blockquote>
          <figcaption class="review-meta"><strong>${esc(rev.name)}</strong>${rev.vehicle ? ' · ' + esc(rev.vehicle) : ''}<br>${esc(rev.date)}${rev.source ? ' · ' + esc(rev.source) : ' · Turo'}</figcaption>
        </figure>`
    )
    .join('\n');

  return `  <section class="section-reviews">
    <div class="wrap">
      <div class="section-head">
        <div class="eyebrow">Guest Reviews</div>
        <h2>What our guests say</h2>
        ${ratingLine}
      </div>
      <div class="grid grid-3">
${cards}
      </div>
      <div class="reviews-cta"><a class="btn ghost" href="${TURO}" target="_blank" rel="noopener" style="color:var(--gold-deep) !important;border-color:var(--gold);">Read all reviews on Turo</a></div>
    </div>
  </section>`;
}

function buildJsonLd(data) {
  if (!data.reviews.length) return '';
  const r = data.summary.rating;
  const count = data.summary.reviewCount || data.reviews.length;
  const obj = {
    '@context': 'https://schema.org',
    '@type': 'AutoRental',
    name: 'SafeWheels Rentals SWFL',
    url: SITE + '/',
    image: SITE + '/img/og-image.png',
    telephone: '+1-657-432-1456',
    sameAs: [TURO],
  };
  if (r) {
    obj.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: r.toFixed(2),
      reviewCount: count,
      bestRating: '5',
      worstRating: '1',
    };
  }
  obj.review = data.reviews.slice(0, 12).map((rev) => ({
    '@type': 'Review',
    reviewRating: { '@type': 'Rating', ratingValue: String(rev.rating), bestRating: '5' },
    author: { '@type': 'Person', name: rev.name },
    datePublished: rev.date,
    reviewBody: rev.text,
  }));
  return `  <script type="application/ld+json">\n${JSON.stringify(obj)}\n  </script>`;
}

function main() {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'reviews.json'), 'utf8'));
  const empty = !data.reviews.length;
  if (empty) {
    console.log('reviews.json has no reviews yet — clearing the reviews section (it stays hidden until you add reviews).');
  }

  // When empty, write nothing between the markers (section disappears, no fake content ships).
  const section = empty ? '' : buildSection(data);
  const jsonld = empty ? '' : buildJsonLd(data);
  let changed = 0;

  for (const file of HTML_TARGETS) {
    const fp = path.join(ROOT, file);
    if (!fs.existsSync(fp)) continue;
    let html = fs.readFileSync(fp, 'utf8');
    let out = replaceRegion(html, 'REVIEWS', section);
    if (LD_TARGETS.includes(file)) {
      const withLd = replaceRegion(out || html, 'REVIEWS-LD', jsonld);
      if (withLd) out = withLd;
    }
    if (out && out !== html) {
      fs.writeFileSync(fp, out);
      changed++;
      console.log('updated ' + file);
    } else if (!out) {
      console.log('skip ' + file + ' (no <!-- REVIEWS:START/END --> markers found)');
    }
  }
  console.log(`\nDone. ${data.reviews.length} reviews, ${changed} page(s) updated.`);
}

main();
