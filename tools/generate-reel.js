// Builds a "photo with music" video for Instagram: a clean STATIC 4:5 image (no
// zoom, no text overlay) with an upbeat, license-safe music bed. Looks like a
// traditional photo post but carries audio (Instagram requires video for sound).
// Requires ffmpeg (auto-installed on GitHub runners). Returns true on success.
const { execFileSync, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// GitHub runners don't ship ffmpeg by default — install it on demand.
function ensureFfmpeg() {
  try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); }
  catch (_) {
    try {
      console.log("Installing ffmpeg…");
      execSync("sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg", { stdio: "ignore" });
      execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    } catch (e) { console.error("Could not install ffmpeg:", e.message); return false; }
  }
  return true;
}

// Generate a bright, upbeat, license-safe music bed once (a major-chord motif with a
// bouncy tremolo). Drop your own royalty-free assets/reel-music.mp3 to override it.
function ensureReelMusic(music) {
  if (fs.existsSync(music)) return true;
  try {
    fs.mkdirSync(path.dirname(music), { recursive: true });
    execFileSync("ffmpeg", [
      "-y",
      "-f", "lavfi", "-i", "sine=frequency=523.25:duration=16",  // C5
      "-f", "lavfi", "-i", "sine=frequency=659.25:duration=16",  // E5
      "-f", "lavfi", "-i", "sine=frequency=783.99:duration=16",  // G5
      "-f", "lavfi", "-i", "sine=frequency=261.63:duration=16",  // C4 (bass)
      "-filter_complex",
      "[0]volume=0.3[a];[1]volume=0.28[b];[2]volume=0.28[c];[3]volume=0.42[d];" +
      "[a][b][c][d]amix=inputs=4:normalize=0,tremolo=f=6:d=0.6,aecho=0.8:0.85:40:0.2,highpass=f=120,afade=t=in:d=0.4,afade=t=out:st=15:d=1,volume=0.85",
      "-ar", "44100", "-b:a", "128k", music,
    ], { stdio: "pipe" });
    return fs.existsSync(music);
  } catch (e) {
    console.error("Could not generate music (post will be silent):", e.stderr ? e.stderr.toString().slice(-300) : e.message);
    return false;
  }
}

// imagePath -> a static 1080x1350 (4:5) video with music at outPath. `title` is unused
// (kept for caller compatibility) — no text is burned into the image.
function generateReel({ imagePath, title, outPath }) {
  if (!ensureFfmpeg()) return false;
  const music = path.join(path.dirname(outPath), "..", "assets", "reel-music.mp3");
  const hasMusic = ensureReelMusic(music);
  const DUR = 7;
  const vf = "scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350,format=yuv420p";

  const args = ["-y", "-loop", "1", "-framerate", "30", "-i", imagePath];
  if (hasMusic) args.push("-i", music);
  else args.push("-f", "lavfi", "-t", String(DUR), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
  args.push(
    "-vf", vf,
    "-map", "0:v:0", "-map", "1:a:0",
    "-t", String(DUR),
    "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", "30",
    "-c:a", "aac", "-b:a", "128k", "-shortest",
    "-movflags", "+faststart",
    outPath
  );

  try {
    execFileSync("ffmpeg", args, { stdio: "pipe" });
    return true;
  } catch (e) {
    console.error("Video generation failed:", e.stderr ? e.stderr.toString().slice(-600) : e.message);
    return false;
  }
}

module.exports = { generateReel };
