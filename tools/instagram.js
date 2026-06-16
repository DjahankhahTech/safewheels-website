// Instagram publishing/reading that works with EITHER kind of token:
//   1. Facebook user/page token  -> Graph API on graph.facebook.com (Page -> IG business account)
//   2. Instagram-Login token     -> Instagram API on graph.instagram.com (direct IG user)
// It auto-detects which one META is and uses the matching host + IG user id.
//
// Env: META (or IG_ACCESS_TOKEN) = the token. IG_USER_ID optional (skips discovery).
const FB = "https://graph.facebook.com/v21.0";
const IG = "https://graph.instagram.com/v21.0";

function tokenFromEnv() {
  return process.env.IG_ACCESS_TOKEN || process.env.META || process.env.META_TOKEN || null;
}

async function call(method, base, pathname, params) {
  const url = new URL(base + pathname);
  let res;
  if (method === "GET") {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    res = await fetch(url);
  } else {
    res = await fetch(url, { method: "POST", body: new URLSearchParams(params) });
  }
  const json = await res.json();
  return { ok: res.ok, json };
}

// Detect token type and resolve { token, base, userId }. Logs a diagnostic.
async function creds() {
  const token = tokenFromEnv();
  if (!token) return null;

  console.log("--- IG diagnostic ---");

  // Path A: Facebook token -> a Page with a linked instagram_business_account.
  const fb = await call("GET", FB, "/me/accounts", { fields: "id,name,instagram_business_account{id,username}", access_token: token });
  if (fb.ok && Array.isArray(fb.json.data)) {
    console.log(`facebook /me/accounts -> ${fb.json.data.length} page(s):`,
      JSON.stringify(fb.json.data.map((p) => ({ page: p.name, ig: p.instagram_business_account ? p.instagram_business_account.id : null }))));
    for (const p of fb.json.data) {
      if (p.instagram_business_account && p.instagram_business_account.id) {
        console.log(`✓ Facebook-token path. IG id ${p.instagram_business_account.id}`);
        console.log("--- end diagnostic ---");
        return { token, base: FB, userId: process.env.IG_USER_ID || p.instagram_business_account.id };
      }
    }
  } else if (fb.json.error) {
    console.log("facebook /me/accounts ->", JSON.stringify(fb.json.error.message || fb.json.error));
  }

  // Path B: Instagram-Login token -> direct IG user.
  const ig = await call("GET", IG, "/me", { fields: "user_id,username", access_token: token });
  if (ig.ok && (ig.json.user_id || ig.json.id)) {
    const uid = ig.json.user_id || ig.json.id;
    console.log(`✓ Instagram-login path. IG user @${ig.json.username || "?"} (id ${uid})`);
    console.log("--- end diagnostic ---");
    return { token, base: IG, userId: process.env.IG_USER_ID || uid };
  } else if (ig.json.error) {
    console.log("instagram /me ->", JSON.stringify(ig.json.error.message || ig.json.error));
  }

  console.log("--- end diagnostic ---");
  throw new Error(
    "Could not resolve an Instagram account from META. Either (a) it's a Facebook token but the Page has no linked IG business account / lacks instagram_basic, or (b) it's an Instagram token that failed. " +
    "Fix: use a Facebook user token with instagram_basic + instagram_content_publish + pages_show_list and the IG account linked to the Page, OR an Instagram-Login token with instagram_business_basic + instagram_business_content_publish."
  );
}

// Fetch recent posts for the on-site feed grid.
async function recentMedia({ base, userId, token, limit = 8 }) {
  const r = await call("GET", base || FB, `/${userId}/media`, {
    fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp",
    limit: String(limit),
    access_token: token,
  });
  if (!r.ok) throw new Error(`recentMedia failed: ${JSON.stringify(r.json.error || r.json)}`);
  return (r.json.data || []).filter((m) => m.media_type !== "VIDEO" || m.thumbnail_url);
}

// Publish one image post. imageUrl MUST be a public https URL.
async function publishImage({ base, userId, token, imageUrl, caption }) {
  const b = base || FB;
  const created = await call("POST", b, `/${userId}/media`, { image_url: imageUrl, caption, access_token: token });
  if (!created.ok) throw new Error(`media create failed: ${JSON.stringify(created.json.error || created.json)}`);
  await new Promise((r) => setTimeout(r, 5000)); // let IG ingest the image
  const published = await call("POST", b, `/${userId}/media_publish`, { creation_id: created.json.id, access_token: token });
  if (!published.ok) throw new Error(`media publish failed: ${JSON.stringify(published.json.error || published.json)}`);
  return published.json.id;
}

// Publish a Reel. videoUrl MUST be a public https URL to an MP4. IG processes the
// video asynchronously, so we poll the container's status before publishing.
async function publishReel({ base, userId, token, videoUrl, caption }) {
  const b = base || FB;
  const created = await call("POST", b, `/${userId}/media`, { media_type: "REELS", video_url: videoUrl, caption, access_token: token });
  if (!created.ok) throw new Error(`reel create failed: ${JSON.stringify(created.json.error || created.json)}`);
  const id = created.json.id;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 6000));
    const st = await call("GET", b, `/${id}`, { fields: "status_code", access_token: token });
    if (st.json.status_code === "FINISHED") break;
    if (st.json.status_code === "ERROR") throw new Error(`reel processing error: ${JSON.stringify(st.json)}`);
  }
  const published = await call("POST", b, `/${userId}/media_publish`, { creation_id: id, access_token: token });
  if (!published.ok) throw new Error(`reel publish failed: ${JSON.stringify(published.json.error || published.json)}`);
  return published.json.id;
}

module.exports = { creds, recentMedia, publishImage, publishReel, tokenFromEnv };
