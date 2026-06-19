// Generates a standalone DAILY Instagram social post (no blog article): a short
// SWFL tip / local spot / fleet highlight -> caption + image -> silent video (no music).
// Writes blog-queue/last-published.json so the existing post-to-instagram.js posts it.
//
// Required env: ANTHROPIC_API_KEY
// Optional env: IMAGE_API_KEY (AI scene images), BLOG_MODEL
const fs = require("fs");
const path = require("path");
const { ROOT, SITE, TURO, FLEET, resolveVehicle } = require("./lib");
const { generateImage } = require("./generate-image");
const { generateReel } = require("./generate-reel");

const MODEL = process.env.BLOG_MODEL || "claude-sonnet-4-6";
const RAW = "https://raw.githubusercontent.com/DjahankhahTech/safewheels-website/main";

const SOCIAL_TOOL = {
  name: "social_post",
  description: "Return one short, engaging Instagram post for SafeWheels Rentals SWFL that ties into a current Southwest Florida event, season, or happening.",
  input_schema: {
    type: "object",
    required: ["type", "hook", "caption", "vehicle", "imagePrompt", "hashtags"],
    properties: {
      type: { type: "string", enum: ["event", "seasonal", "local-spot", "fleet-highlight"], description: "Kind of post. Prefer 'event' or 'seasonal' — tie it to what's happening in SWFL now." },
      hook: { type: "string", description: "Very short internal label, max ~5 words (not shown on the image)." },
      caption: { type: "string", description: "2-4 punchy, friendly sentences for the IG caption. Tie it to a current/seasonal SWFL event, festival, market, holiday, or activity, and how having a rental car makes it easy to enjoy. No URLs. End with a soft nudge to rent a car. Do NOT mention a blog or 'read more'." },
      vehicle: { type: "string", description: "If type is fleet-highlight, which fleet vehicle: " + Object.keys(FLEET).join(", ") + ". Otherwise 'none'." },
      imagePrompt: { type: "string", description: "Vivid photo prompt for a scenic Southwest Florida image matching the post (used unless this is a fleet-highlight)." },
      hashtags: { type: "string", description: "8-12 relevant hashtags separated by spaces, including #SWFL #CapeCoral #FortMyers plus event/season-relevant ones." },
    },
  },
};

async function generate() {
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });
  const sys = `You run the Instagram for SafeWheels Rentals SWFL, a family Turo car-rental business in Southwest Florida (Cape Coral / Fort Myers / Punta Gorda). Cars are rented EXCLUSIVELY via Turo; the company meets guests at PGD and RSW airports and delivers within 50 miles of ZIP 33955. Voice: warm, local, upbeat. Each post should COMPLEMENT what's happening in Southwest Florida right now — the current season, a well-known recurring local event/festival/market, a holiday, or a timely seasonal activity — and connect it to the convenience of having a car. IMPORTANT: do NOT invent specific dates, times, or event details you're unsure of; keep references to the season or well-known recurring happenings (e.g. "stone crab season," "snowbird season," summer sunset cruises, holiday boat parades). Never mention a street address.`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL, max_tokens: 1200, system: sys,
      tools: [SOCIAL_TOOL], tool_choice: { type: "tool", name: "social_post" },
      messages: [{ role: "user", content: `Today is ${today}. Create today's Instagram post tied to what's happening in Southwest Florida around now (current season or a well-known recurring event/activity). Vary the topic from a typical day. Call social_post.` }],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Anthropic API error: ${JSON.stringify(json).slice(0, 500)}`);
  const tool = (json.content || []).find((c) => c.type === "tool_use");
  if (!tool) throw new Error("No tool call: " + JSON.stringify(json).slice(0, 400));
  return tool.input;
}

(async () => {
  if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY is not set."); process.exit(1); }
  const post = await generate();

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // YYYY-MM-DD
  const slug = `social-${today}`;
  const vehicle = post.type === "fleet-highlight" ? resolveVehicle(post.vehicle) : null;

  // Image: fleet photo for a fleet highlight, otherwise an AI scene (fallback to a fleet photo).
  let heroImg, fallbackImg;
  if (vehicle) {
    heroImg = vehicle.img; fallbackImg = vehicle.img;
  } else {
    fallbackImg = FLEET.telluride.img;
    const buf = await generateImage(`${post.imagePrompt}. Professional travel photograph, full-frame DSLR 35mm, natural golden-hour Southwest Florida light, photorealistic, sharp focus, true-to-life colors. NOT an illustration or 3D render. No text, no watermark, no logos, no readable license plates.`);
    if (buf) {
      fs.mkdirSync(path.join(ROOT, "img", "social"), { recursive: true });
      heroImg = `img/social/${slug}.jpg`;
      fs.writeFileSync(path.join(ROOT, heroImg), buf);
      console.log("Used AI scene image.");
    } else { heroImg = fallbackImg; console.log("Used fleet photo (no AI image)."); }
  }

  // SILENT video (no music) from the image.
  let reelPath = null;
  try {
    fs.mkdirSync(path.join(ROOT, "reels"), { recursive: true });
    const rp = `reels/${slug}.mp4`;
    if (generateReel({ imagePath: path.join(ROOT, heroImg), title: post.hook, outPath: path.join(ROOT, rp) })) {
      reelPath = rp; console.log("Generated silent social video:", rp);
    }
  } catch (e) { console.error("Video step skipped:", e.message); }

  const igCaption = `${post.caption}\n\n🚗 Rent your SWFL ride on Turo — link in bio.\n\n${post.hashtags}`;
  fs.writeFileSync(path.join(ROOT, "blog-queue", "last-published.json"), JSON.stringify({
    slug, title: post.hook,
    imagePublicUrl: `${RAW}/${heroImg}`,
    fallbackImageUrl: `${RAW}/${fallbackImg}`,
    reelPublicUrl: reelPath ? `${RAW}/${reelPath}` : null,
    reelFallbackUrl: reelPath ? `${SITE}/${reelPath}` : null,
    igCaption,
  }, null, 2) + "\n");

  console.log(`Generated daily social post (${post.type}): "${post.hook}"`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
