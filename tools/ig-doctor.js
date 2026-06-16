// Diagnostic: prints exactly what the META (or IG_ACCESS_TOKEN) token can see in
// the Graph API, so we can pinpoint why Instagram publishing won't connect.
// Never prints the token or any page access tokens.
const token = process.env.META || process.env.IG_ACCESS_TOKEN;
const GRAPH = "https://graph.facebook.com/v21.0";

(async () => {
  if (!token) { console.log("❌ No META / IG_ACCESS_TOKEN env set."); process.exit(0); }

  async function g(pathname, fields) {
    const u = new URL(GRAPH + pathname);
    if (fields) u.searchParams.set("fields", fields);
    u.searchParams.set("access_token", token);
    const r = await fetch(u);
    return { ok: r.ok, json: await r.json() };
  }

  // 1) Who/what is this token?
  const me = await g("/me", "id,name");
  if (!me.ok) {
    console.log("❌ Token rejected by Graph API. Likely expired or invalid.");
    console.log("   Error:", JSON.stringify(me.json.error || me.json));
    process.exit(0);
  }
  console.log(`✓ Token works. Identity: ${me.json.name || "(no name)"} (id ${me.json.id})`);

  // 2) What Pages can it see, and is an IG business/creator account attached?
  const pages = await g("/me/accounts", "id,name,instagram_business_account{id,username}");
  if (!pages.ok) {
    console.log("❌ /me/accounts failed — token almost certainly lacks 'pages_show_list'.");
    console.log("   Error:", JSON.stringify(pages.json.error || pages.json));
    process.exit(0);
  }
  const data = pages.json.data || [];
  if (data.length === 0) {
    console.log("❌ Token sees ZERO Facebook Pages.");
    console.log("   Causes: token missing 'pages_show_list', OR this user/app doesn't manage the Page,");
    console.log("   OR the token is a plain user token rather than one granted Page access.");
    process.exit(0);
  }
  console.log(`✓ Sees ${data.length} Page(s):`);
  let found = null;
  for (const p of data) {
    const ig = p.instagram_business_account;
    console.log(`   - "${p.name}" (Page ${p.id}) -> IG: ${ig ? `@${ig.username || "?"} (id ${ig.id})` : "NONE LINKED"}`);
    if (ig) found = ig;
  }

  if (found) {
    console.log(`\n✅ READY. Use IG account id ${found.id}. Posting should work — re-run the blog workflow.`);
  } else {
    console.log("\n❌ A Page is visible but NO Instagram account is attached to it in the Graph API.");
    console.log("   Fix: Facebook Page → Settings → Linked accounts → Instagram → connect @safewheels_rentals_swfl,");
    console.log("   confirm the IG account is set to Professional (Business/Creator), then regenerate the token.");
  }
})().catch((e) => { console.log("Doctor crashed:", e.message); });
