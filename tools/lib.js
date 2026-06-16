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
      <div><h4>SafeWheels Rentals SWFL</h4><p>A family business serving Southwest Florida with quality cars and top-notch customer service. Turo All-Star Host.</p></div>
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
