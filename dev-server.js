// Local dev server for the SafeWheels site + availability API.
// Run:  node "dev-server.js"   then open  http://localhost:3000/availability.html
// (Serverless function is served at /api/availability, just like on Vercel.)
const http = require("http");
const fs = require("fs");
const path = require("path");
const availability = require("./api/availability.js");

const ROOT = __dirname;
const TYPES = { ".html":"text/html", ".css":"text/css", ".js":"text/javascript",
  ".json":"application/json", ".jpg":"image/jpeg", ".jpeg":"image/jpeg",
  ".png":"image/png", ".svg":"image/svg+xml", ".ico":"image/x-icon" };

const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://localhost");
  if (u.pathname === "/api/availability") return availability(req, res);

  let p = decodeURIComponent(u.pathname);
  if (p === "/" || p === "") p = "/index.html";
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.statusCode = 403; return res.end("Forbidden"); }
  fs.readFile(file, (err, data) => {
    if (err) { res.statusCode = 404; res.end("Not found"); return; }
    res.setHeader("Content-Type", TYPES[path.extname(file).toLowerCase()] || "application/octet-stream");
    res.end(data);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`SafeWheels dev server → http://localhost:${PORT}/   (Ctrl+C to stop)`));
