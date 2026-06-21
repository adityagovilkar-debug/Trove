import sharp from "sharp";
import { readFileSync } from "fs";

// Rasterizes public/icons/icon.svg into the static PNGs used by the favicon,
// Apple touch icon, and PWA manifest. Re-run if the source SVG changes.
const svg = readFileSync("public/icons/icon.svg");
const jobs = [
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["public/icons/icon-maskable.png", 512],
  ["app/icon.png", 512],
  ["app/apple-icon.png", 180],
];
for (const [out, size] of jobs) {
  await sharp(svg, { density: 512 }).resize(size, size).png().toFile(out);
  console.log("wrote", out, size);
}
