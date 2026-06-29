// Builds a SILENT video for Instagram: a clean STATIC 4:5 image (no zoom, no text
// overlay) with no audio track, per owner preference (no music). Posted as a Reel
// (Instagram requires video for the Reel format). Requires ffmpeg (auto-installed
// on GitHub runners). Returns true on success.
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

// imagePath -> a static 1080x1350 (4:5) SILENT video at outPath. `title` is unused
// (kept for caller compatibility) — no text is burned into the image, no music.
function generateReel({ imagePath, title, outPath }) {
  if (!ensureFfmpeg()) return false;
  const DUR = 7;
  // 4:5 (1080x1350) frame. To keep the WHOLE vehicle visible in a landscape photo,
  // fill the frame with a blurred zoomed copy and center the full sharp image on top
  // (the polished Instagram look — no cropping the car's nose/tail off).
  const fc =
    "[0:v]split=2[bg][fg];" +
    "[bg]scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350,boxblur=26:3,eq=brightness=-0.06[bgb];" +
    "[fg]scale=1080:1350:force_original_aspect_ratio=decrease[fgs];" +
    "[bgb][fgs]overlay=(W-w)/2:(H-h)/2,format=yuv420p[v]";

  // Silent audio track (Instagram still expects an audio stream on the video).
  const args = ["-y", "-loop", "1", "-framerate", "30", "-i", imagePath];
  args.push("-f", "lavfi", "-t", String(DUR), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
  args.push(
    "-filter_complex", fc,
    "-map", "[v]", "-map", "1:a:0",
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
