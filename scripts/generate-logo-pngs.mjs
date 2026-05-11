/**
 * Script one-shot pour convertir les SVG V2 du logo Elite Turf en PNG
 * dans toutes les tailles requises par Next.js + Google News + iOS.
 *
 * Usage :
 *   node scripts/generate-logo-pngs.mjs
 *
 * Dépendances : sharp (déjà installé pour /api/og)
 *
 * Outputs :
 *   - app/icon.png             (32x32, favicon défaut Next.js)
 *   - app/icon-192.png         (192x192, web app manifest)
 *   - app/icon-512.png         (512x512, web app manifest haute densité)
 *   - app/apple-icon.png       (180x180, iOS home screen)
 *   - public/images/logo-v2/logo-square-1000.png      (Publisher Center)
 *   - public/images/logo-v2/logo-horizontal-1000.png  (Knowledge Graph)
 */

import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const TASKS = [
  // Favicons Next.js (à partir du favicon SVG = symbole seul, bg bleu nuit)
  { src: "public/images/logo-v2/favicon.svg",                  out: "app/icon.png",                                         size: 32,  bg: { r: 30, g: 58, b: 95, alpha: 1 } },
  { src: "public/images/logo-v2/favicon.svg",                  out: "app/icon-192.png",                                     size: 192, bg: { r: 30, g: 58, b: 95, alpha: 1 } },
  { src: "public/images/logo-v2/favicon.svg",                  out: "app/icon-512.png",                                     size: 512, bg: { r: 30, g: 58, b: 95, alpha: 1 } },
  { src: "public/images/logo-v2/favicon.svg",                  out: "app/apple-icon.png",                                   size: 180, bg: { r: 30, g: 58, b: 95, alpha: 1 } },
  // Logo carré 1000x1000 bleu nuit (Google News Publisher Center, JSON-LD)
  { src: "public/images/logo-v2/logo-square-blue.svg",         out: "public/images/logo-v2/logo-square-1000.png",          size: 1000, bg: { r: 30, g: 58, b: 95, alpha: 1 } },
  // Logo horizontal 1000x200 bleu nuit (Knowledge Graph)
  { src: "public/images/logo-v2/logo-horizontal-blue.svg",     out: "public/images/logo-v2/logo-horizontal-1000.png",      w: 1000, h: 200, bg: { r: 30, g: 58, b: 95, alpha: 1 } },
  // Logo carré 1000x1000 blanc (emails sur fond clair, Stripe checkout sur fond blanc, partenariats)
  { src: "public/images/logo-v2/logo-square-white.svg",        out: "public/images/logo-v2/logo-square-white-1000.png",    size: 1000, bg: { r: 255, g: 255, b: 255, alpha: 1 } },
  // Logo carré 1000x1000 transparent (header navbar du site sur fond sombre, overlays)
  { src: "public/images/logo-v2/logo-square-transparent.svg",  out: "public/images/logo-v2/logo-square-transparent-1000.png", size: 1000, bg: { r: 0, g: 0, b: 0, alpha: 0 } },
];

async function convert({ src, out, size, w, h, bg }) {
  const inputPath  = resolve(ROOT, src);
  const outputPath = resolve(ROOT, out);
  mkdirSync(dirname(outputPath), { recursive: true });

  const svg = readFileSync(inputPath);
  let pipeline = sharp(svg, { density: 600 });

  const background = bg ?? { r: 30, g: 58, b: 95, alpha: 1 }; // défaut = bleu nuit
  if (size) {
    pipeline = pipeline.resize(size, size, { fit: "contain", background });
  } else if (w && h) {
    pipeline = pipeline.resize(w, h, { fit: "contain", background });
  }

  const buf = await pipeline.png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(outputPath, buf);
  const sizeKb = (buf.length / 1024).toFixed(1);
  const dim = size ? `${size}x${size}` : `${w}x${h}`;
  console.log(`✓ ${out.padEnd(56)} ${dim.padEnd(12)} ${sizeKb} KB`);
}

console.log("Generating Elite Turf V2 logo PNGs…\n");
for (const task of TASKS) {
  try {
    await convert(task);
  } catch (err) {
    console.error(`✗ ${task.out}: ${err.message}`);
    process.exit(1);
  }
}
console.log("\nAll PNGs generated successfully.");
