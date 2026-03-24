/**
 * Script de génération de l'image Open Graph Elite Turf (1200×630px)
 * Nécessite : npm install canvas
 * Usage    : node scripts/generate-og-image.js
 * Sortie   : public/og-image.jpg
 */

const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

const WIDTH = 1200;
const HEIGHT = 630;

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext("2d");

/* ── Fond sombre ── */
ctx.fillStyle = "#0D0D14";
ctx.fillRect(0, 0, WIDTH, HEIGHT);

/* ── Grille dorée subtile ── */
ctx.strokeStyle = "rgba(201,168,76,0.06)";
ctx.lineWidth = 1;
for (let x = 0; x < WIDTH; x += 80) {
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke();
}
for (let y = 0; y < HEIGHT; y += 80) {
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke();
}

/* ── Halo doré central ── */
const grad = ctx.createRadialGradient(600, 315, 60, 600, 315, 420);
grad.addColorStop(0,   "rgba(201,168,76,0.18)");
grad.addColorStop(0.5, "rgba(201,168,76,0.06)");
grad.addColorStop(1,   "rgba(13,13,20,0)");
ctx.fillStyle = grad;
ctx.fillRect(0, 0, WIDTH, HEIGHT);

/* ── Bandeau supérieur ── */
ctx.fillStyle = "rgba(201,168,76,0.12)";
ctx.fillRect(0, 0, WIDTH, 5);

/* ── Logo texte ── */
ctx.font = "bold 62px Georgia, serif";
ctx.fillStyle = "#C9A84C";
ctx.textAlign = "center";
ctx.fillText("ELITE TURF", 600, 240);

/* ── Sous-titre ── */
ctx.font = "300 28px Arial, sans-serif";
ctx.fillStyle = "#F5F5F0";
ctx.fillText("Pronostics PMU · Quinté+ · Vincennes · Longchamp", 600, 300);

/* ── Séparateur doré ── */
const sep = ctx.createLinearGradient(200, 330, 1000, 330);
sep.addColorStop(0,   "transparent");
sep.addColorStop(0.5, "#C9A84C");
sep.addColorStop(1,   "transparent");
ctx.strokeStyle = sep;
ctx.lineWidth = 1.5;
ctx.beginPath();
ctx.moveTo(200, 335);
ctx.lineTo(1000, 335);
ctx.stroke();

/* ── Accroche ── */
ctx.font = "italic 22px Georgia, serif";
ctx.fillStyle = "#9090A0";
ctx.fillText("Les courses PMU analysées depuis Paris, pour l'Afrique francophone", 600, 390);

/* ── URL ── */
ctx.font = "bold 18px Arial, sans-serif";
ctx.fillStyle = "rgba(201,168,76,0.7)";
ctx.fillText("eliteturf.fr", 600, 460);

/* ── Bandeau inférieur ── */
ctx.fillStyle = "rgba(201,168,76,0.12)";
ctx.fillRect(0, HEIGHT - 5, WIDTH, 5);

/* ── Export JPEG ── */
const outputPath = path.join(__dirname, "../public/og-image.jpg");
const buffer = canvas.toBuffer("image/jpeg", { quality: 0.92 });
fs.writeFileSync(outputPath, buffer);
console.log(`✅  og-image.jpg généré → ${outputPath}`);
console.log(`   Dimensions : ${WIDTH}×${HEIGHT}px`);
