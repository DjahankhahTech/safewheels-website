// One-off: regenerate the existing AI blog hero images with the new realistic
// photographic style, save them as JPEG, and update the page + blog-card references
// from .png to .jpg. Needs IMAGE_API_KEY (run in the Action or locally with the key):
//   IMAGE_API_KEY=sk-... node tools/regen-images.js
const fs = require("fs");
const path = require("path");
const { generateImage } = require("./generate-image");
const ROOT = path.join(__dirname, "..");

const SUFFIX = "Professional travel photograph shot on a full-frame DSLR with a 35mm lens, natural golden-hour Southwest Florida daylight, photorealistic with sharp focus, realistic textures, true-to-life colors and subtle depth of field — like a real travel-magazine photo. NOT an illustration, painting, cartoon, or 3D render. No text, no watermark, no logos, no readable license plates.";

const SCENES = {
  "caloosahatchee-river-towns-road-trip": "A scenic riverfront drive along the Caloosahatchee River through a historic small Southwest Florida river town, palm-lined waterfront and a quaint main street",
  "cape-coral-waterway-wonders-boating-bridges-bites": "Cape Coral Florida canal waterways with boats and a bridge, waterfront restaurants, bright sunny day",
  "charlotte-harbor-kayak-fishing-nature-guide": "Kayaking on calm Charlotte Harbor at golden hour, mangrove shoreline and wading birds, Southwest Florida nature",
  "corkscrew-swamp-immokalee-road-trip": "A wooden boardwalk winding through the bald-cypress forest of Corkscrew Swamp Sanctuary near Immokalee, lush green wetland",
  "naples-day-trip-guide-swfl": "The Naples Florida pier and white-sand beach at golden hour with tall palm trees and gentle Gulf waves",
  "island-hopping-pine-island-matlacha-swfl": "The colorful Matlacha fishing village on Pine Island, artsy waterfront cottages and mangrove islands under blue sky",
};

async function regenImages() {
  if (!process.env.IMAGE_API_KEY) { console.log("IMAGE_API_KEY not set — skipping image regeneration."); return 0; }
  let done = 0;
  for (const [slug, scene] of Object.entries(SCENES)) {
    const buf = await generateImage(`${scene}. ${SUFFIX}`);
    if (!buf) { console.error(`✗ ${slug}: generation failed, leaving existing image.`); continue; }
    const jpg = `img/blog/${slug}.jpg`;
    fs.writeFileSync(path.join(ROOT, jpg), buf);
    const png = path.join(ROOT, `img/blog/${slug}.png`);
    if (fs.existsSync(png)) fs.unlinkSync(png);

    // Repoint the post page and the blog card from .png to .jpg.
    for (const file of [path.join(ROOT, slug + ".html"), path.join(ROOT, "blog.html")]) {
      if (!fs.existsSync(file)) continue;
      const before = fs.readFileSync(file, "utf8");
      const after = before.split(`img/blog/${slug}.png`).join(`img/blog/${slug}.jpg`);
      if (after !== before) fs.writeFileSync(file, after);
    }
    console.log(`✓ ${slug} regenerated -> ${jpg}`);
    done++;
  }
  return done;
}

module.exports = { regenImages };

// Allow running directly: IMAGE_API_KEY=... node tools/regen-images.js
if (require.main === module) {
  regenImages().then((n) => console.log(`Done — ${n} image(s) regenerated.`)).catch((e) => { console.error(e.message || e); process.exit(1); });
}
