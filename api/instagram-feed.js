// Returns the latest @safewheels_rentals_swfl posts for the on-site feed grid.
// Vercel serverless function. Env (set in the Vercel project):
//   META (or IG_ACCESS_TOKEN)   long-lived access token
//   IG_USER_ID                  optional — auto-discovered from the token if omitted
// Cached 1h at the edge so we don't hammer the Graph API on every visit.
const GRAPH = "https://graph.facebook.com/v21.0";

async function resolveUserId(token) {
  if (process.env.IG_USER_ID) return process.env.IG_USER_ID;
  const u = new URL(`${GRAPH}/me/accounts`);
  u.searchParams.set("fields", "id,instagram_business_account");
  u.searchParams.set("access_token", token);
  const r = await fetch(u);
  const j = await r.json();
  for (const p of (j.data || [])) if (p.instagram_business_account) return p.instagram_business_account.id;
  return null;
}

module.exports = async (req, res) => {
  const token = process.env.IG_ACCESS_TOKEN || process.env.META;
  if (!token) { res.status(200).json({ configured: false, data: [] }); return; }
  try {
    const userId = await resolveUserId(token);
    if (!userId) { res.status(200).json({ configured: true, error: true, data: [] }); return; }
    const url = new URL(`${GRAPH}/${userId}/media`);
    url.searchParams.set("fields", "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp");
    url.searchParams.set("limit", "8");
    url.searchParams.set("access_token", token);
    const r = await fetch(url);
    const json = await r.json();
    if (!r.ok) { res.status(200).json({ configured: true, error: true, data: [] }); return; }
    const data = (json.data || []).map((m) => ({
      id: m.id,
      permalink: m.permalink,
      caption: (m.caption || "").slice(0, 140),
      image: m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url,
    })).filter((m) => m.image);
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json({ configured: true, data });
  } catch (e) {
    res.status(200).json({ configured: true, error: true, data: [] });
  }
};
