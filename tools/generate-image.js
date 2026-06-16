// Optional AI hero-image generation. Disabled unless IMAGE_API_KEY is set.
// Uses an OpenAI-compatible Images API (works with OpenAI gpt-image-1 and the
// Vercel AI Gateway image endpoint). Env:
//   IMAGE_API_KEY   API key (presence = feature enabled)
//   IMAGE_API_URL   default https://api.openai.com/v1/images/generations
//   IMAGE_MODEL     default gpt-image-1
// Returns a Buffer (PNG/JPEG) or null if disabled/failed (caller falls back to a real fleet photo).
async function generateImage(prompt) {
  const key = process.env.IMAGE_API_KEY;
  if (!key) return null;
  const url = process.env.IMAGE_API_URL || "https://api.openai.com/v1/images/generations";
  const model = process.env.IMAGE_MODEL || "gpt-image-1";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      // jpeg + 1024-wide: Instagram only reliably accepts JPEG and caps width at 1440px.
      body: JSON.stringify({ model, prompt, n: 1, size: "1024x1024", output_format: "jpeg" }),
    });
    const json = await res.json();
    if (!res.ok) { console.error("Image API error:", JSON.stringify(json).slice(0, 400)); return null; }
    const d = json.data && json.data[0];
    if (d && d.b64_json) return Buffer.from(d.b64_json, "base64");
    if (d && d.url) { const r = await fetch(d.url); return Buffer.from(await r.arrayBuffer()); }
    return null;
  } catch (e) {
    console.error("Image generation failed:", e.message);
    return null;
  }
}

module.exports = { generateImage };
