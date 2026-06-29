// Generates a fresh SWFL/Turo blog post with Claude, renders it into the site
// template, adds a hero image (AI-generated if IMAGE_API_KEY is set, else a real
// fleet photo), inserts the blog card, and records the post for the Instagram step.
//
// Required env:  ANTHROPIC_API_KEY
// Optional env:  BLOG_MODEL (default claude-sonnet-4-6)
//                IG_USER_ID + IG_ACCESS_TOKEN  -> seed ideas from recent IG captions
//                IMAGE_API_KEY (+ IMAGE_API_URL / IMAGE_MODEL) -> AI hero images
const fs = require("fs");
const path = require("path");
const { ROOT, SITE, FLEET, resolveVehicle, pickRealPhoto, renderPostPage, insertBlogCard, existingTitles, todayPretty } = require("./lib");
const { generateReel } = require("./generate-reel");
const { recentMedia, creds } = require("./instagram");

const MODEL = process.env.BLOG_MODEL || "claude-sonnet-4-6";

const POST_TOOL = {
  name: "publish_blog_post",
  description: "Return one complete, ready-to-publish blog post for the SafeWheels Rentals SWFL website.",
  input_schema: {
    type: "object",
    required: ["slug", "title", "category", "excerpt", "metaDescription", "vehicle", "heroImagePrompt", "bodyHtml"],
    properties: {
      slug: { type: "string", description: "URL slug, lowercase kebab-case, no extension. e.g. fort-myers-river-district-day" },
      title: { type: "string", description: "Engaging post title, ~6-12 words. No site name." },
      category: { type: "string", enum: ["Local Guide", "Travel Tips", "Travel Guide", "Food & Drink", "Safety", "Things to Do"] },
      excerpt: { type: "string", description: "One-sentence teaser, ~15-25 words." },
      metaDescription: { type: "string", description: "SEO meta description, <=155 chars." },
      vehicle: { type: "string", description: "Which fleet vehicle best fits this trip. One of: " + Object.keys(FLEET).join(", ") },
      heroImagePrompt: { type: "string", description: "A vivid photo prompt for a scenic Southwest Florida lifestyle image to accompany the post (the chosen vehicle on a SWFL road/beach setting)." },
      bodyHtml: { type: "string", description: "The article body as clean HTML: 3-5 <h2> sections with <p> and optional <ul><li>. Indented 6 spaces. Do NOT include the title, hero image, the Book-on-Turo button, or the back link — those are added automatically. Naturally mention airport pickup at PGD/RSW and delivery within 50 mi of 33955 where it fits. Never include a street address." },
    },
  },
};

async function generate({ avoidTitles, igInspiration }) {
  const sys = `You write the blog for SafeWheels Rentals SWFL, a family-run Turo car-rental business in Southwest Florida (Cape Coral / Fort Myers / Punta Gorda area). Cars are rented EXCLUSIVELY through Turo. The company meets guests at Punta Gorda (PGD) and Fort Myers (RSW) airports and delivers within 50 miles of ZIP 33955. NEVER mention a physical street address or office. Voice: warm, local, helpful, lightly promotional. Audience: tourists, snowbirds, and newcomers to SWFL. Each post should be genuinely useful (a real local guide or travel tip) and subtly tie back to the convenience of having a rental car.`;
  const lines = [
    "Write ONE new blog post. It must be a fresh topic — do NOT repeat or closely overlap any of these existing posts:",
    ...avoidTitles.map((t) => `  - ${t}`),
  ];
  if (igInspiration && igInspiration.length) {
    lines.push("", "For inspiration, here are recent Instagram captions from the business (you may build on these themes, but write an original article — do not copy):");
    igInspiration.forEach((c) => lines.push(`  - ${c.replace(/\s+/g, " ").slice(0, 240)}`));
  }
  lines.push("", "Pick whichever fleet vehicle best suits the trip you describe. Call the publish_blog_post tool with the finished post.");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 3000,
      system: sys,
      tools: [POST_TOOL],
      tool_choice: { type: "tool", name: "publish_blog_post" },
      messages: [{ role: "user", content: lines.join("\n") }],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Anthropic API error: ${JSON.stringify(json).slice(0, 500)}`);
  const tool = (json.content || []).find((c) => c.type === "tool_use");
  if (!tool) throw new Error("Model did not return a tool call: " + JSON.stringify(json).slice(0, 500));
  return tool.input;
}

async function maybeIgInspiration() {
  try {
    const c = await creds();
    if (!c) return [];
    const media = await recentMedia({ base: c.base, userId: c.userId, token: c.token, limit: 6 });
    return media.map((m) => m.caption).filter(Boolean);
  } catch (e) {
    console.error("Could not fetch IG inspiration (continuing without):", e.message);
    return [];
  }
}

(async () => {
  if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY is not set."); process.exit(1); }

  const avoidTitles = existingTitles();
  const igInspiration = await maybeIgInspiration();
  const post = await generate({ avoidTitles, igInspiration });

  const slug = String(post.slug).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) throw new Error("Empty slug from model.");
  if (fs.existsSync(path.join(ROOT, slug + ".html"))) {
    console.error(`Post ${slug}.html already exists — skipping to avoid overwrite.`); process.exit(0);
  }

  const vehicle = resolveVehicle(post.vehicle) || FLEET.telluride;

  // Hero image: a REAL photo of this post's vehicle (authentic, never AI). Falls back to
  // the vehicle's stock fleet photo when we don't have a premium shot of that model.
  const photo = pickRealPhoto(vehicle.key);
  const heroImg = (photo && photo.file) || vehicle.img;
  console.log(`Used real photo: ${heroImg} (${vehicle.name})`);

  const pubdate = todayPretty();
  const page = renderPostPage({
    title: post.title,
    metaDescription: post.metaDescription,
    category: post.category,
    pubdate,
    bodyHtml: post.bodyHtml,
    heroImg,
    heroAlt: `${vehicle.name} — SafeWheels Rentals SWFL`,
    slug,
  });
  fs.writeFileSync(path.join(ROOT, slug + ".html"), page);
  insertBlogCard({ slug, title: post.title, excerpt: post.excerpt, category: post.category, pubdate, image: heroImg });

  // Build a SILENT video (no music) from the hero image, committed alongside the post.
  let reelPath = null;
  try {
    fs.mkdirSync(path.join(ROOT, "reels"), { recursive: true });
    const rp = `reels/${slug}.mp4`;
    if (generateReel({ imagePath: path.join(ROOT, heroImg), title: post.title, outPath: path.join(ROOT, rp) })) {
      reelPath = rp;
      console.log("Generated silent video:", rp);
    }
  } catch (e) { console.error("Video step skipped:", e.message); }

  // Hand off to the Instagram step. The repo is public, so raw.githubusercontent.com
  // serves the media instantly after push (no dependency on the Vercel deploy). For the
  // Reel we also pass the Vercel site URL as a fallback (it serves proper video/mp4).
  const RAW = "https://raw.githubusercontent.com/DjahankhahTech/safewheels-website/main";
  const hashtags = "#SWFL #CapeCoral #FortMyers #PuntaGorda #Sanibel #Naples #TuroHost #CarRental #FloridaTravel #SnowbirdSeason";
  const igCaption = `${post.title}\n\n${post.excerpt}\n\n📖 Read it on our blog (link in bio) · 🚗 Book your SWFL ride on Turo.\n\n${hashtags}`;
  fs.writeFileSync(path.join(ROOT, "blog-queue", "last-published.json"), JSON.stringify({
    slug, title: post.title, excerpt: post.excerpt, category: post.category, pubdate,
    url: `${SITE}/${slug}.html`,
    imagePublicUrl: `${RAW}/${heroImg}`,
    fallbackImageUrl: `${RAW}/${vehicle.img}`,
    reelPublicUrl: reelPath ? `${RAW}/${reelPath}` : null,
    reelFallbackUrl: reelPath ? `${SITE}/${reelPath}` : null,
    igCaption,
  }, null, 2) + "\n");

  console.log(`Generated & published: "${post.title}" -> ${slug}.html`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
