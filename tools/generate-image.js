// AI hero-image generation. Disabled unless IMAGE_API_KEY is set.
//
// When reference photo(s) are provided, we call the image EDITS endpoint with our REAL
// fleet photos as the reference (our "training data") and input_fidelity:high — so the
// generated scene depicts the SAME real vehicle (correct make/model/color/trim) in a
// fresh setting, looking authentic rather than a generic AI car. Without references it
// falls back to plain text-to-image.
//
// Env:
//   IMAGE_API_KEY    API key (presence = feature enabled)
//   IMAGE_API_URL    text-to-image, default https://api.openai.com/v1/images/generations
//   IMAGE_EDIT_URL   reference edits,  default https://api.openai.com/v1/images/edits
//   IMAGE_MODEL      default gpt-image-1
//   IMAGE_SIZE       default 1536x1024 (landscape — best framing for a vehicle)
// Returns a Buffer (JPEG) or null if disabled/failed (caller falls back to the real photo).
const fs = require("fs");
const path = require("path");

async function generateImage(prompt, referencePaths = []) {
  const key = process.env.IMAGE_API_KEY;
  if (!key) return null;
  const model = process.env.IMAGE_MODEL || "gpt-image-1";
  const size = process.env.IMAGE_SIZE || "1536x1024";
  const refs = (referencePaths || []).filter((p) => {
    try { return p && fs.existsSync(p); } catch { return false; }
  });
  try {
    let res;
    if (refs.length) {
      // Reference-conditioned generation: keep the real vehicle, restyle the scene.
      const editUrl = process.env.IMAGE_EDIT_URL || "https://api.openai.com/v1/images/edits";
      const form = new FormData();
      form.append("model", model);
      form.append("prompt", prompt);
      form.append("size", size);
      form.append("quality", "high");
      form.append("input_fidelity", "high"); // preserve the reference vehicle's look
      form.append("output_format", "jpeg");
      for (const p of refs) {
        form.append("image[]", new Blob([fs.readFileSync(p)], { type: "image/jpeg" }), path.basename(p));
      }
      res = await fetch(editUrl, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
    } else {
      const url = process.env.IMAGE_API_URL || "https://api.openai.com/v1/images/generations";
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, prompt, n: 1, size, quality: "high", output_format: "jpeg" }),
      });
    }
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
