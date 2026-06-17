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

  // Post ONE thing per blog: the Reel. The static photo is only a fallback for when
  // no Reel could be generated (e.g. ffmpeg failed) or every Reel attempt is rejected.
  if (post.reelPublicUrl) {
    for (const url of [post.reelPublicUrl, post.reelFallbackUrl].filter(Boolean)) {
      console.log(`Trying Reel from ${url} …`);
      if (!(await waitForUrl(url))) { console.error("Reel URL not live in time:", url); continue; }
      try {
        const rid = await publishReel({ base: c.base, userId: c.userId, token: c.token, videoUrl: url, caption: post.igCaption });
        console.log(`Posted Reel (media id ${rid}): ${post.title}`);
        return; // one post per blog — done.
      } catch (e) { console.error("Reel attempt failed:", e.message); }
    }
    console.error("Reel could not be posted — falling back to a photo.");
  }

  // Fallback: post the static photo (hero image, else the live fleet photo).
  for (const imageUrl of [post.imagePublicUrl, post.fallbackImageUrl].filter(Boolean)) {
    console.log(`Trying photo from ${imageUrl} …`);
    if (!(await waitForUrl(imageUrl))) { console.error("Photo URL not live in time:", imageUrl); continue; }
    try {
      const id = await publishImage({ base: c.base, userId: c.userId, token: c.token, imageUrl, caption: post.igCaption });
      console.log(`Posted photo (media id ${id}): ${post.title}`);
      return;
    } catch (e) { console.error("Photo attempt failed:", e.message); }
  }
  console.error("Nothing posted to Instagram (blog still published).");
})();
