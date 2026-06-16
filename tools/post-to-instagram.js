// Cross-posts the most recently generated blog post to Instagram.
// Reads blog-queue/last-published.json (written by generate-post.js).
// Token from env META / IG_ACCESS_TOKEN. No-op (exit 0) if creds are missing or
// there's nothing to post — the blog stays published regardless.
const fs = require("fs");
const path = require("path");
const { publishImage, publishReel, creds } = require("./instagram");

// Poll a public URL until it serves 200 (the new image must be deployed before IG fetches it).
async function waitForUrl(url, timeoutMs = 330000, intervalMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url, { method: "HEAD" });
      if (r.ok) return true;
    } catch (_) { /* keep waiting */ }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

(async () => {
  let c;
  try { c = await creds(); } catch (e) { console.error("Instagram credentials problem (skipping):", e.message); return; }
  if (!c) { console.log("No Instagram token (META / IG_ACCESS_TOKEN) set — skipping cross-post."); return; }

  const file = path.join(__dirname, "..", "blog-queue", "last-published.json");
  if (!fs.existsSync(file)) { console.log("No last-published.json — nothing to cross-post."); return; }
  const post = JSON.parse(fs.readFileSync(file, "utf8"));

  // Prefer the post's hero image once it's live; fall back to the (already-live) fleet photo.
  let imageUrl = post.imagePublicUrl;
  console.log(`Waiting for ${imageUrl} to be publicly available…`);
  if (!(await waitForUrl(imageUrl))) {
    if (post.fallbackImageUrl) {
      console.log(`Hero image not live in time — using fallback ${post.fallbackImageUrl}`);
      imageUrl = post.fallbackImageUrl;
      if (!(await waitForUrl(imageUrl, 30000))) { console.error("Fallback image also unreachable — skipping IG post."); return; }
    } else {
      console.error("Image not reachable and no fallback — skipping IG post."); return;
    }
  }

  try {
    const id = await publishImage({ base: c.base, userId: c.userId, token: c.token, imageUrl, caption: post.igCaption });
    console.log(`Posted to Instagram (media id ${id}): ${post.title}`);
  } catch (e) {
    // If the hero image was rejected by IG, retry once with the live fleet photo.
    if (post.fallbackImageUrl && imageUrl !== post.fallbackImageUrl && (await waitForUrl(post.fallbackImageUrl, 30000))) {
      try {
        const id = await publishImage({ base: c.base, userId: c.userId, token: c.token, imageUrl: post.fallbackImageUrl, caption: post.igCaption });
        console.log(`Posted to Instagram with fallback image (media id ${id}): ${post.title}`);
        return;
      } catch (e2) { console.error("Fallback IG post also failed (blog still published):", e2.message); return; }
    }
    // Don't fail the whole workflow if IG posting hiccups — the blog is already live.
    console.error("Instagram cross-post failed (blog still published):", e.message);
  }

  // Also publish a Reel if one was generated and is live.
  if (post.reelPublicUrl) {
    console.log(`Waiting for Reel ${post.reelPublicUrl} to be publicly available…`);
    if (await waitForUrl(post.reelPublicUrl)) {
      try {
        const rid = await publishReel({ base: c.base, userId: c.userId, token: c.token, videoUrl: post.reelPublicUrl, caption: post.igCaption });
        console.log(`Posted Reel (media id ${rid}): ${post.title}`);
      } catch (e) { console.error("Reel post failed (blog + photo still published):", e.message); }
    } else {
      console.error("Reel not live in time — skipping Reel post.");
    }
  }
})();
