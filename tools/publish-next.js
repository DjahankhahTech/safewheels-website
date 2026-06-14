// Publishes the next queued blog post: stamps today's date, writes the page to
// the site root, inserts a card at the top of blog.html, and marks it published.
// Run by .github/workflows/weekly-blog.yml each week (TZ=America/New_York).
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const QUEUE = path.join(ROOT, "blog-queue", "queue.json");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const data = JSON.parse(fs.readFileSync(QUEUE, "utf8"));
const next = data.posts.find((p) => !p.published);
if (!next) { console.log("Blog queue is empty — nothing to publish. Add posts to blog-queue/."); process.exit(0); }

const pubdate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

// 1) Write the post page to the site root with the publish date stamped in.
const src = path.join(ROOT, "blog-queue", "posts", next.slug + ".html");
const html = fs.readFileSync(src, "utf8").replace(/\[\[PUBDATE\]\]/g, pubdate);
fs.writeFileSync(path.join(ROOT, next.slug + ".html"), html);

// 2) Insert the card at the top of the blog index grid.
const blogPath = path.join(ROOT, "blog.html");
let blog = fs.readFileSync(blogPath, "utf8");
const marker = '<div class="grid grid-2">';
const i = blog.indexOf(marker);
if (i === -1) { console.error("Could not find the blog grid marker in blog.html."); process.exit(1); }
const at = i + marker.length;
const card = `\n        <a class="post" href="${next.slug}.html"><div class="date">${esc(pubdate)} · ${esc(next.category)}</div><h3>${esc(next.title)}</h3><p style="color:var(--muted);margin-top:8px;">${esc(next.excerpt)}</p></a>`;
blog = blog.slice(0, at) + card + blog.slice(at);
fs.writeFileSync(blogPath, blog);

// 3) Mark it published in the queue.
next.published = true;
next.publishedDate = pubdate;
fs.writeFileSync(QUEUE, JSON.stringify(data, null, 2) + "\n");

const remaining = data.posts.filter((p) => !p.published).length;
console.log(`Published: ${next.title} -> ${next.slug}.html  (${remaining} left in queue)`);
if (remaining <= 1) console.log("⚠ Blog queue is running low — add more posts to blog-queue/.");
