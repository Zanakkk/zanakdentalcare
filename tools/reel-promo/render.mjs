// Render reel.html to an MP4 (1080x1920, 30fps) using Chromium + ffmpeg.
// Usage:
//   node render.mjs [page.html]                 -> out/<page>.mp4 (with music from music.py)
//   node render.mjs [page.html] --stills 1,5,9  -> out/still-<t>.jpg previews
// page defaults to reel.html (the clinic promo).
import { createRequire } from "node:module";
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// playwright is installed globally in this environment, so load it via require
const { chromium } = createRequire(import.meta.url)("playwright");

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "out");
mkdirSync(out, { recursive: true });
const FPS = 30;
const pageFile = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "reel.html";
const name = pageFile.replace(/\.html$/, "");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto("file://" + join(here, pageFile));
await page.evaluate(() => document.fonts.ready);
await page.waitForLoadState("networkidle");

const stillsArg = process.argv.indexOf("--stills");
if (stillsArg > 0) {
  for (const t of process.argv[stillsArg + 1].split(",").map(Number)) {
    await page.evaluate(t => window.render(t), t);
    await page.screenshot({ path: join(out, `still-${t}.jpg`), type: "jpeg", quality: 80 });
  }
  await browser.close();
  process.exit(0);
}

const { duration, scenes, cards, click } = await page.evaluate(() => ({
  duration: window.DURATION, scenes: window.SCENES, cards: window.CARD_TIMES,
  click: window.CLICK_TIME ?? window.SCENES[5] + 1.8,
}));

// music + sound effects synced to the animation timeline
const audio = join(out, "music.wav");
execFileSync("python3", ["-I", join(here, "music.py"), audio, JSON.stringify({ duration, scenes, cards, click })], { stdio: "inherit" });

const video = join(out, name + ".mp4");
const ff = spawn("ffmpeg", [
  "-y", "-v", "error",
  "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
  "-i", audio,
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20",
  "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart",
  video,
], { stdio: ["pipe", "inherit", "inherit"] });

const frames = Math.round(duration * FPS);
for (let f = 0; f < frames; f++) {
  await page.evaluate(t => window.render(t), f / FPS);
  const buf = await page.screenshot({ type: "jpeg", quality: 92 });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r));
  if (f % 60 === 0) process.stdout.write(`frame ${f}/${frames}\n`);
}
ff.stdin.end();
await new Promise(r => ff.on("close", r));
await browser.close();
console.log("done:", video);
