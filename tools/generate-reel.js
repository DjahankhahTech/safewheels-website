// Builds a 9:16 1080x1920 ~8s Instagram Reel from the post's hero image:
// a slow Ken-Burns zoom + the post title overlaid near the bottom, with audio
// (assets/reel-music.mp3 if present, otherwise a silent track). Requires ffmpeg,
// which is preinstalled on GitHub Actions ubuntu runners. Returns true on success.
const { execFileSync, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// GitHub runners don't ship ffmpeg by default — install it (and a font) on demand.
function ensureFfmpeg() {
  try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); }
  catch (_) {
    try {
      console.log("Installing ffmpeg…");
      execSync("sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg fonts-dejavu-core", { stdio: "ignore" });
      execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    } catch (e) { console.error("Could not install ffmpeg:", e.message); return false; }
  }
  return true;
}

function findFont() {
  const candidates = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
  ];
  return candidates.find((f) => fs.existsSync(f)) || null;
}

// Wrap a title into short lines for the overlay.
function wrap(text, maxChars = 22) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > maxChars) { if (line) lines.push(line); line = w; }
    else line = (line + " " + w).trim();
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

// Generate a warm, license-safe background music bed (a soft major-chord pad) once,
// so Reels have sound. Drop your own royalty-free assets/reel-music.mp3 to override.
function ensureReelMusic(music) {
  if (fs.existsSync(music)) return true;
  try {
    fs.mkdirSync(path.dirname(music), { recursive: true });
    execFileSync("ffmpeg", [
      "-y",
      "-f", "lavfi", "-i", "sine=frequency=220:duration=16",     // A3 (bass)
      "-f", "lavfi", "-i", "sine=frequency=329.63:duration=16",  // E4
      "-f", "lavfi", "-i", "sine=frequency=440:duration=16",     // A4
      "-f", "lavfi", "-i", "sine=frequency=554.37:duration=16",  // C#5  -> warm A-major pad
      "-filter_complex",
      "[0]volume=0.5[b];[1]volume=0.3[c];[2]volume=0.28[d];[3]volume=0.22[e];" +
      "[b][c][d][e]amix=inputs=4:normalize=0,tremolo=f=4:d=0.22,aecho=0.8:0.88:80:0.35,lowpass=f=3000,afade=t=in:d=2,afade=t=out:st=14:d=2,volume=0.7",
      "-ar", "44100", "-b:a", "128k", music,
    ], { stdio: "pipe" });
    return fs.existsSync(music);
  } catch (e) {
    console.error("Could not generate reel music (Reel will be silent):", e.stderr ? e.stderr.toString().slice(-300) : e.message);
    return false;
  }
}

function generateReel({ imagePath, title, outPath }) {
  if (!ensureFfmpeg()) return false;
  const font = findFont();
  const titleTxt = outPath + ".title.txt";
  fs.writeFileSync(titleTxt, wrap(title));
  const music = path.join(path.dirname(outPath), "..", "assets", "reel-music.mp3");
  const hasMusic = ensureReelMusic(music);

  const DUR = 8, FPS = 30, frames = DUR * FPS;
  const vf = [
    "scale=2160:3840:force_original_aspect_ratio=increase",
    "crop=2160:3840",
    `zoompan=z='min(zoom+0.0007,1.16)':d=${frames}:s=1080x1920:fps=${FPS}`,
    // Only overlay the title if a font is available.
    ...(font ? [`drawtext=fontfile=${font}:textfile=${titleTxt}:fontcolor=white:fontsize=58:line_spacing=14:box=1:boxcolor=black@0.5:boxborderw=28:x=(w-text_w)/2:y=h-text_h-210`] : []),
    "format=yuv420p",
  ].join(",");

  const args = ["-y", "-i", imagePath];
  if (hasMusic) args.push("-i", music);
  else args.push("-f", "lavfi", "-t", String(DUR), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
  args.push(
    "-vf", vf,
    "-map", "0:v:0", "-map", "1:a:0",
    "-t", String(DUR),
    "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "128k", "-shortest",
    "-movflags", "+faststart",
    outPath
  );

  try {
    execFileSync("ffmpeg", args, { stdio: "pipe" });
    try { fs.unlinkSync(titleTxt); } catch (_) {}
    return true;
  } catch (e) {
    console.error("Reel generation failed:", e.stderr ? e.stderr.toString().slice(-600) : e.message);
    try { fs.unlinkSync(titleTxt); } catch (_) {}
    return false;
  }
}

module.exports = { generateReel };
