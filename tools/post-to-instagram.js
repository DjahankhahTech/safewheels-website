// Cross-posts the most recently generated blog post to Instagram.
// Reads blog-queue/last-published.json (written by generate-post.js).
// Required env: IG_USER_ID, IG_ACCESS_TOKEN
// No-op (exit 0) if creds are missing or there's nothing to post — so the
// workflow still succeeds and the blog is published regardless.
const fs = require("fs");
const path = require("path");
const { publishImage } = require("./instagram");

(async () => {
  const userId = process.env.IG_USER_ID, token = process.env.IG_ACCESS_TOKEN;
  if (!userId || !token) { console.log("IG_USER_ID / IG_ACCESS_TOKEN not set — skipping Instagram cross-post."); return; }

  const file = path.join(__dirname, "..", "blog-queue", "last-published.json");
  if (!fs.existsSync(file)) { console.log("No last-published.json — nothing to cross-post."); return; }
  const post = JSON.parse(fs.readFileSync(file, "utf8"));

  try {
    const id = await publishImage({ userId, token, imageUrl: post.imagePublicUrl, caption: post.igCaption });
    console.log(`Posted to Instagram (media id ${id}): ${post.title}`);
  } catch (e) {
    // Don't fail the whole workflow if IG posting hiccups — the blog is already live.
    console.error("Instagram cross-post failed (blog still published):", e.message);
  }
})();
