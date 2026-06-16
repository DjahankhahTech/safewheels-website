// Instagram Graph API helpers (read recent media + publish a single image post).
// Requires an Instagram BUSINESS/CREATOR account linked to a Facebook Page,
// plus a long-lived access token. Env:
//   IG_USER_ID       Instagram Business Account ID (numeric)
//   IG_ACCESS_TOKEN  long-lived page/user access token
const GRAPH = "https://graph.facebook.com/v21.0";

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

module.exports = { recentMedia, publishImage };
