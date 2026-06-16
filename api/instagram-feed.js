// Returns the latest @safewheels_rentals_swfl posts for the on-site feed grid.
// Vercel serverless function. Works with either a Facebook token (Page->IG) or an
// Instagram-Login token. Env (set in the Vercel project):
//   META (or IG_ACCESS_TOKEN)   long-lived access token
//   IG_USER_ID                  optional — auto-discovered from the token if omitted
// Cached 1h at the edge so we don't hammer the Graph API on every visit.
const FB = "https://graph.facebook.com/v21.0";
const IG = "https://graph.instagram.com/v21.0";

// Resolve { base, userId } from whichever token type META is.
async function resolve(token) {
  if (process.env.IG_USER_ID) {
    // Try both hosts; pick the one that serves this user's media.
    return { base: FB, userId: process.env.IG_USER_ID };
  }
  // Facebook token -> Page with linked instagram_business_account.
  try {
    const u = new URL(`${FB}/me/accounts`);
    u.searchParams.set("fields", "instagram_business_account");
    u.searchParams.set("access_token", token);
    const j = await (await fetch(u)).json();
    for (const p of (j.data || [])) if (p.instagram_business_account) return { base: FB, userId: p.instagram_business_account.id };
  } catch (_) {}
  // Instagram-Login token -> direct IG user.
  try {
    const u = new URL(`${IG}/me`);
    u.searchParams.set("fields", "user_id,username");
    u.searchParams.set("access_token", token);
    const j = await (await fetch(u)).json();
    if (j.user_id || j.id) return { base: IG, userId: j.user_id || j.id };
  } catch (_) {}
  return null;
}

module.exports = async (req, res) => {
  const token = process.env.IG_ACCESS_TOKEN || process.env.META;
  if (!token) { res.status(200).json({ configured: false, data: [] }); return; }
  try {
    const r0 = await resolve(token);
    if (!r0) { res.status(200).json({ configured: true, error: true, data: [] }); return; }
    const url = new URL(`${r0.base}/${r0.userId}/media`);
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
