// Shared helpers for the blog automation pipeline.
// Zero dependencies — relies on Node 20+ globals (fetch, fs).
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE = "https://safewheelsrentalsswfl.com";
const TURO = "https://turo.com/us/en/drivers/795431";

// The fleet. `book` = per-vehicle Turo listing; `img` = real photo already live on the site.
const FLEET = {
  telluride:  { name: "Kia Telluride",     img: "img/fleet/kia-telluride.jpg",    book: "https://turo.com/us/en/suv-rental/united-states/cape-coral-fl/kia/telluride/2901165" },
  pathfinder: { name: "Nissan Pathfinder",  img: "img/fleet/nissan-pathfinder.jpg", book: "https://turo.com/us/en/suv-rental/united-states/cape-coral-fl/nissan/pathfinder/3345597" },
  santafe:    { name: "Hyundai Santa Fe",   img: "img/fleet/hyundai-santa-fe.jpg",  book: "https://turo.com/us/en/suv-rental/united-states/cape-coral-fl/hyundai/santa-fe/2979761" },
  traverse:   { name: "Chevrolet Traverse", img: "img/fleet/chevy-traverse.jpg",    book: "https://turo.com/us/en/suv-rental/united-states/cape-coral-fl/chevrolet/traverse/2939523" },
  wrangler:   { name: "Jeep Wrangler",      img: "img/fleet/jeep-wrangler.jpg",     book: "https://turo.com/us/en/suv-rental/united-states/cape-coral-fl/jeep/wrangler/3343831" },
  kona:       { name: "Hyundai Kona",       img: "img/fleet/hyundai-kona.jpg",      book: "https://turo.com/us/en/suv-rental/united-states/cape-coral-fl/hyundai/kona/2900729" },
  k4:         { name: "Kia K4",             img: "img/fleet/kia-k4.jpg",            book: "https://turo.com/us/en/car-rental/united-states/cape-coral-fl/kia/k4/3368517" },
  elantra:    { name: "Hyundai Elantra",    img: "img/fleet/hyundai-elantra.jpg",   book: "https://turo.com/us/en/car-rental/united-states/cape-coral-fl/hyundai/elantra/2990653" },
  sentra:     { name: "Nissan Sentra",      img: "img/fleet/nissan-sentra.jpg",     book: "https://turo.com/us/en/car-rental/united-states/cape-coral-fl/nissan/sentra/3345686" },
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Resolve a vehicle key the model returned (tolerant of "santa-fe", "Kia Telluride", etc.).
function resolveVehicle(key) {
  if (!key) return null;
  const norm = String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const [k, v] of Object.entries(FLEET)) {
    const nameNorm = v.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (norm === k || norm.includes(k) || nameNorm.includes(norm) || norm.includes(nameNorm)) return { key: k, ...v };
  }
  return null;
}

// Build the full blog post page, matching the site's existing template exactly.
function renderPostPage({ title, metaDescription, category, pubdate, bodyHtml, heroImg, heroAlt, slug }) {
  const canonical = `${SITE}/${slug}.html`;
  const ogImage = heroImg ? `${SITE}/${heroImg}` : `${SITE}/img/og-image.png`;
  const hero = heroImg
    ? `\n  <div class="wrap"><img src="${heroImg}" alt="${esc(heroAlt || title)}" style="width:100%;max-height:460px;object-fit:cover;border-radius:14px;margin:24px 0;"></div>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} — SafeWheels Rentals SWFL</title>
  <meta name="description" content="${esc(metaDescription)}">
  <link rel="stylesheet" href="styles.css">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="SafeWheels Rentals SWFL">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(metaDescription)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${ogImage}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:image" content="${ogImage}">
  <!-- Google Analytics 4 -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-1QQHYW23LD"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-1QQHYW23LD');</script>
</head>
<body>
  <header class="site-header">
    <nav class="nav">
      <a class="brand" href="index.html"><img src="img/logo-transparent.png" alt="SafeWheels Rentals SWFL logo" class="logo-img"><span class="brand-text">SafeWheels Rentals SWFL</span></a>
      <div class="nav-links">
        <a class="navlink" href="availability.html">Availability</a>
        <a class="navlink" href="about.html">About</a>
        <a class="navlink" href="rental-agreement.html">Rental Agreement</a>
        <a class="navlink" href="cancellation.html">Cancellation</a>
        <a class="navlink" href="blog.html">Blog</a>
        <a class="btn" href="${TURO}" target="_blank" rel="noopener">Book Now</a>
      </div>
    </nav>
  </header>

  <div class="page-hero"><div class="wrap"><p class="tagline" style="color:var(--gold);">${esc(category)} · ${esc(pubdate)}</p><h1>${esc(title)}</h1></div></div>
${hero}
  <section>
    <div class="wrap prose">
${bodyHtml}
      <p><a class="btn" href="${TURO}" target="_blank" rel="noopener">Book your ride on Turo</a></p>
      <p><a href="blog.html">← Back to the blog</a></p>
    </div>
  </section>

  <footer class="site-footer">
    <div class="wrap footer-grid">
      <div><h4>SafeWheels Rentals SWFL</h4><p>A family business serving Southwest Florida with quality cars and top-notch customer service. Turo All-Star Host.</p><div class="social"><a href="https://www.facebook.com/SafeWheelsRentals" target="_blank" rel="noopener" aria-label="Facebook"><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.99 3.66 9.13 8.44 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99C18.34 21.13 22 16.99 22 12z"/></svg></a><a href="https://www.instagram.com/safewheels_rentals_swfl/" target="_blank" rel="noopener" aria-label="Instagram"><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.43.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.43.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.81 3.81 0 0 1-1.38-.9 3.81 3.81 0 0 1-.9-1.38c-.16-.43-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.43-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.31-1.46.72-2.13 1.38C1.35 2.68.94 3.35.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.79.72 1.46 1.38 2.13.67.66 1.34 1.07 2.13 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.79-.31 1.46-.72 2.13-1.38.66-.67 1.07-1.34 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.78 5.78 0 0 0-1.38-2.13A5.78 5.78 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0zM12 5.84A6.16 6.16 0 1 0 12 18.16 6.16 6.16 0 0 0 12 5.84zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zM18.41 4.15a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z"/></svg></a></div></div>
      <div><h4>Policies</h4><ul>
        <li><a href="about.html">About</a></li>
        <li><a href="rental-agreement.html">Rental Agreement</a></li>
        <li><a href="cancellation.html">Cancellation</a></li>
        <li><a href="guest-incident-procedure.html">Guest Incident Procedure</a></li>
        <li><a href="privacy.html">Privacy Policy</a></li>
      </ul></div>
      <div><h4>Contact</h4><ul>
        <li><a href="tel:+16574321456">+1 (657) 432-1456</a></li>
        <li><a href="mailto:safewheelsrentals@gmail.com">safewheelsrentals@gmail.com</a></li>
        <li>Serving PGD &amp; RSW airports<br>Delivery within 50 mi of 33955</li>
      </ul></div>
    </div>
    <div class="footer-bottom wrap">© 2026 SafeWheels Rentals SWFL. All rights reserved.</div>
  </footer>
  <!-- Vercel Web Analytics + Speed Insights -->
  <script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments);};document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href*="turo.com"]');if(a){window.va('event',{name:'turo_click',data:{href:a.href}});}});</script>
  <script defer src="/_vercel/insights/script.js"></script>
  <script defer src="/_vercel/speed-insights/script.js"></script>
</body>
</html>
`;
}

// Insert a card at the top of the blog index grid.
function insertBlogCard({ slug, title, excerpt, category, pubdate, image }) {
  const blogPath = path.join(ROOT, "blog.html");
  let blog = fs.readFileSync(blogPath, "utf8");
  const marker = '<div class="grid grid-2">';
  const i = blog.indexOf(marker);
  if (i === -1) throw new Error("Could not find the blog grid marker in blog.html.");
  const at = i + marker.length;
  const img = image ? `<img class="post-thumb" src="${image}" alt="${esc(title)}" loading="lazy">` : "";
  const card = `\n        <a class="post" href="${slug}.html">${img}<div class="date">${esc(pubdate)} · ${esc(category)}</div><h3>${esc(title)}</h3><p style="color:var(--muted);margin-top:8px;">${esc(excerpt)}</p></a>`;
  blog = blog.slice(0, at) + card + blog.slice(at);
  fs.writeFileSync(blogPath, blog);
}

// Read the titles of already-published posts so the generator avoids repeats.
function existingTitles() {
  const blog = fs.readFileSync(path.join(ROOT, "blog.html"), "utf8");
  return [...blog.matchAll(/<h3>([^<]+)<\/h3>/g)].map((m) => m[1].replace(/&amp;/g, "&").trim());
}

function todayPretty() {
  return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });
}

module.exports = { ROOT, SITE, TURO, FLEET, esc, resolveVehicle, renderPostPage, insertBlogCard, existingTitles, todayPretty };
