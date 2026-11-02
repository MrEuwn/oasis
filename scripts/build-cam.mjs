// Encodes the counted replays for the admin tile. Timelines (public/cam/*.json)
// are produced by cv/count.py; this script only makes the video small enough to loop.
//   node scripts/build-cam.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FF = process.env.FFMPEG || 'ffmpeg';
const OUT = path.join(ROOT, 'public/cam');
mkdirSync(OUT, { recursive: true });

const CAMS = [
  { name: 'library', src: 'cv/media/cded-counted.mp4', crop: 'scale=1280:-2' },
  { name: 'canteen', src: 'cv/media/canteen-counted.mp4', crop: 'scale=1280:-2' },
];

const kb = (p) => `${(statSync(p).size / 1024).toFixed(0)} KB`;

for (const cam of CAMS) {
  const src = path.join(ROOT, cam.src);
  if (!existsSync(src)) {
    console.log(`${cam.name}: skip, ${cam.src} missing (run cv/count.py first)`);
    continue;
  }
  execFileSync(FF, ['-y', '-i', src, '-vf', `${cam.crop},fps=5`,
    '-an', '-c:v', 'libx264', '-profile:v', 'main', '-crf', '28', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', path.join(OUT, `${cam.name}.mp4`)], { stdio: 'inherit' });
  execFileSync(FF, ['-y', '-ss', '6', '-i', src, '-frames:v', '1',
    '-vf', `${cam.crop}`, path.join(OUT, `${cam.name}.jpg`)], { stdio: 'inherit' });

  const timelinePath = path.join(OUT, `${cam.name}.json`);
  const timeline = existsSync(timelinePath) ? JSON.parse(readFileSync(timelinePath, 'utf8')) : null;
  const peak = timeline ? Math.max(...timeline.samples.map((s) => s.people)) : 0;
  console.log(`${cam.name}: ${timeline?.samples.length ?? 0} samples · peak ${peak}p · ` +
    `${kb(path.join(OUT, `${cam.name}.mp4`))} · ${kb(path.join(OUT, `${cam.name}.jpg`))}`);
}
