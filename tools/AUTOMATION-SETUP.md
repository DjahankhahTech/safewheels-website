# Blog + Instagram automation — setup checklist

The pipeline auto-generates a fresh SWFL blog post **Mon/Wed/Fri ~9:13am ET**, publishes it
to the site (Vercel auto-deploys), and cross-posts it to Instagram. It also embeds your live
IG feed on `/blog.html`.

It's already coded. To turn it on you need to (1) add API keys as GitHub secrets, (2) upload
the updated workflow file, and (3) connect Instagram on Meta's side. Steps below.

---

## 1. Anthropic API key (writes the posts) — REQUIRED

1. Get a key at https://console.anthropic.com → API Keys.
2. In GitHub: repo **DjahankhahTech/safewheels-website** → Settings → Secrets and variables →
   Actions → **New repository secret**.
3. Name: `ANTHROPIC_API_KEY`  · Value: your key.
4. (Optional) Variable `BLOG_MODEL` (Actions → Variables tab) to pin a model. Default: `claude-sonnet-4-6`.

Without this, the run does nothing (it's the only hard requirement).

---

## 2. Instagram auto-posting + on-site feed — REQUIRED for IG features

Instagram only allows API posting from a **Business or Creator** account linked to a Facebook Page.

1. **Convert the IG account** `@safewheels_rentals_swfl` to a Business/Creator account
   (IG app → Settings → Account type and tools → Switch to professional account).
2. **Create / link a Facebook Page** for SafeWheels and connect it to that IG account
   (IG app → Settings → Linked accounts, or via the Facebook Page → Settings → Linked accounts).
3. **Create a Meta app**: https://developers.facebook.com → My Apps → Create App → type "Business".
   Add the **Instagram Graph API** product.
4. **Get a long-lived access token + your IG Business Account ID.** Easiest path:
   - Use the Graph API Explorer (https://developers.facebook.com/tools/explorer) with permissions
     `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`.
   - Generate a User token, then exchange it for a **long-lived** token (~60 days):
     `GET /oauth/access_token?grant_type=fb_exchange_token&client_id=APPID&client_secret=SECRET&fb_exchange_token=SHORT_TOKEN`
   - Find your IG Business Account ID: `GET /me/accounts` → get the Page id, then
     `GET /{page-id}?fields=instagram_business_account`.
5. **Add GitHub secrets** (same place as step 1):
   - `IG_USER_ID` = the Instagram Business Account ID (numeric)
   - `IG_ACCESS_TOKEN` = the long-lived token
6. **Add the same two as Vercel env vars** (for the on-site feed):
   Vercel → project `website` → Settings → Environment Variables → add `IG_USER_ID` and
   `IG_ACCESS_TOKEN` (Production). Redeploy. The "Follow us on Instagram" grid on /blog.html
   appears automatically once the API returns posts.

> **Token expiry:** long-lived tokens last ~60 days. Refresh before then by re-running the
> exchange call (or set a reminder). If posting stops, a stale token is the usual cause.

---

## 3. AI hero images (optional)

By default each post uses your **real fleet photo** for the chosen vehicle (accurate + already live).
To instead generate an AI scenic image per post:

- Add secret `IMAGE_API_KEY` (OpenAI-compatible image key, e.g. an OpenAI key for `gpt-image-1`).
- (Optional) Variables `IMAGE_API_URL` and `IMAGE_MODEL` to use a different provider.

If the image API ever fails, it silently falls back to the fleet photo — the post still publishes.

> Note: AI images are *scenic/lifestyle* shots, not photos of your actual cars. For a rental
> business, real fleet photos build more trust; AI images are best as a stylistic option.

---

## 4. Activate the schedule — REQUIRED

The workflow file `.github/workflows/weekly-blog.yml` was updated to run Mon/Wed/Fri and to
generate + cross-post. The local git token can't push workflow files, so upload it via the web:

1. GitHub repo → `.github/workflows/weekly-blog.yml` → ✏️ Edit (or Add file → Upload files).
2. Paste the contents of the local file at
   `website/.github/workflows/weekly-blog.yml` and commit.
3. Settings → Actions → General → Workflow permissions → **Read and write permissions**.

### Test it now (no waiting for the schedule)
GitHub → Actions tab → "Blog automation (Mon/Wed/Fri)" → **Run workflow**. Watch the run:
it should generate a post, commit it, and (if IG is set up) post to Instagram.

---

## How it works (files)

| File | Role |
|------|------|
| `tools/generate-post.js` | Calls Claude → writes a fresh post into the site template, picks a vehicle + hero image, inserts the blog card, records `blog-queue/last-published.json`. Seeds ideas from recent IG captions if IG creds are set. |
| `tools/generate-image.js` | Optional AI hero image (else real fleet photo). |
| `tools/post-to-instagram.js` | Cross-posts the new article to Instagram. |
| `tools/instagram.js` / `tools/lib.js` | Shared helpers (Graph API, fleet map, page template). |
| `api/instagram-feed.js` | Serverless endpoint powering the on-site IG grid. |
| `.github/workflows/weekly-blog.yml` | The Mon/Wed/Fri schedule that runs it all. |
