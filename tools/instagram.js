// Instagram Graph API helpers (read recent media + publish a single image post).
// Requires an Instagram BUSINESS/CREATOR account linked to a Facebook Page,
// plus a long-lived access token. Env (token from any of these):
//   IG_ACCESS_TOKEN  -or-  META   long-lived access token
//   IG_USER_ID       (optional) Instagram Business Account ID — auto-discovered if omitted
const GRAPH = "https://graph.facebook.com/v21.0";

// Read the access token from whichever env var is set (supports a single `META` secret).
function tokenFromEnv() {
  return process.env.IG_ACCESS_TOKEN || process.env.META || process.env.META_TOKEN || null;
}

// Discover the Instagram Business Account ID from just a token (via the linked FB Page).
// Returns null if the token can't see a connected IG business account.
async function resolveUserId(token) {
  if (process.env.IG_USER_ID) return process.env.IG_USER_ID;

  // Detailed diagnostics so the workflow logs pinpoint the exact problem.
  async function probe(pathname, fields) {
    const url = new URL(GRAPH + pathname);
    if (fields) url.searchParams.set("fields", fields);
    url.searchParams.set("access_token", token);
    const r = await fetch(url);
    return { ok: r.ok, json: await r.json() };
  }
  console.log("--- IG diagnostic ---");
  const me = await probe("/me", "id,name");
  console.log("/me ->", JSON.stringify(me.json.error ? me.json : { id: me.json.id, name: me.json.name }));

  const pages = await probe("/me/accounts", "id,name,instagram_business_account{id,username}");
  if (pages.json.error) console.log("/me/accounts ERROR ->", JSON.stringify(pages.json.error));
  const data = (pages.json && pages.json.data) || [];
  console.log(`/me/accounts -> ${data.length} page(s):`,
    JSON.stringify(data.map((p) => ({ page: p.name, ig: p.instagram_business_account ? p.instagram_business_account.id : null }))));
  console.log("--- end diagnostic ---");

  for (const p of data) {
    if (p.instagram_business_account && p.instagram_business_account.id) return p.instagram_business_account.id;
  }
  throw new Error("No Instagram Business Account found on this token's Pages. Ensure @safewheels_rentals_swfl is a Business/Creator account linked to a Facebook Page, and the token has instagram_basic + instagram_content_publish + pages_show_list.");
}

// Resolve {userId, token} from the environment in one call.
async function creds() {
  const token = tokenFromEnv();
  if (!token) return null;
  const userId = await resolveUserId(token);
  return { token, userId };
}

async function gget(pathname, params) {
  const url = new URL(GRAPH + pathname);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(`IG GET ${pathname} failed: ${JSON.stringify(json)}`);
  return json;
}

async function gpost(pathname, params) {
  const url = new URL(GRAPH + pathname);
  const body = new URLSearchParams(params);
  const res = await fetch(url, { method: "POST", body });
  const json = await res.json();
  if (!res.ok) throw new Error(`IG POST ${pathname} failed: ${JSON.stringify(json)}`);
  return json;
}

// Fetch the N most recent posts for the embedded site feed.
async function recentMedia({ userId, token, limit = 8 }) {
  const json = await gget(`/${userId}/media`, {
    fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp",
    limit: String(limit),
    access_token: token,
  });
  return (json.data || []).filter((m) => m.media_type !== "VIDEO" || m.thumbnail_url);
}

// Publish one image post. imageUrl MUST be a public https URL Instagram can fetch.
async function publishImage({ userId, token, imageUrl, caption }) {
  const created = await gpost(`/${userId}/media`, { image_url: imageUrl, caption, access_token: token });
  // IG occasionally needs a moment to finish ingesting the image before publish.
  await new Promise((r) => setTimeout(r, 5000));
  const published = await gpost(`/${userId}/media_publish`, { creation_id: created.id, access_token: token });
  return published.id;
}

module.exports = { recentMedia, publishImage, creds, resolveUserId, tokenFromEnv };
