// Rasterizes public/icons/icon.svg into the PNG sizes a PWA needs.
// Run: node scripts/generate-icons.mjs
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(root, "public/icons/icon.svg"));

const targets = [
  { out: "public/icons/icon-192.png", size: 192 },
  { out: "public/icons/icon-512.png", size: 512 },
  { out: "public/icons/icon-maskable.png", size: 512 }, // full-bleed = maskable-safe
  { out: "app/icon.png", size: 256 }, // Next.js favicon
  { out: "app/apple-icon.png", size: 180 }, // iOS home screen
];

await Promise.all(
  targets.map(({ out, size }) =>
    sharp(svg, { density: 384 })
      .resize(size, size)
      .png()
      .toFile(join(root, out))
      .then(() => console.log(`✓ ${out} (${size}px)`)),
  ),
);
console.log("Done.");
