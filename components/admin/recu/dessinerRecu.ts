/**
 * Dessine le reçu Orange Money / Wave en JPG, dans le navigateur de l'admin
 * (canvas, sans dépendance ni serveur). Maquette validée par Steph le
 * 10/11/2026 : fond nuit, or, logo fer à cheval. Le texte vient tout prêt de
 * lib/paiement/recu-mobile-money.ts (lu en base par la route
 * /api/admin/paiements/recu) : ce fichier ne fait que le placer.
 *
 * Unités : maquette de 540 px de large, dessinée ×2 → JPG de 1080 px (net sur
 * téléphone). La hauteur suit le contenu.
 */
import type { Recu } from "@/lib/paiement/recu-mobile-money";
import { numeroWhatsappLisible } from "@/lib/constants/whatsapp";

const C = {
  fond: "#12121C",
  carte: "#181826",
  trait: "#2A2A3E",
  or: "#C9A84C",
  orClair: "#E8D5A3",
  orFonce: "#A07830",
  texte: "#F5F5F0",
  gris: "#9090A0",
  vert: "#22C55E",
};
const LARGEUR = 540;
const ECHELLE = 2;
const MARGE = 30;
const UTILE = LARGEUR - 2 * MARGE;
const HAUTEUR_MAX = 1000;
const SERIF = '"Playfair Display", Georgia, serif';
const SANS = "Inter, system-ui, sans-serif";
const MONO = 'Consolas, "Courier New", monospace';
const LOGO = "/images/logo-v2/logo-square-transparent-1000.png";

type Ctx = CanvasRenderingContext2D;

/** Les polices du site (globals.css) doivent être chargées avant de dessiner. */
async function chargerPolices(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const polices = [
    '700 25px "Playfair Display"',
    'italic 400 15px "Playfair Display"',
    "400 13px Inter",
    "500 12px Inter",
    "600 13px Inter",
    "700 46px Inter",
  ];
  await Promise.all(polices.map((p) => document.fonts.load(p).catch(() => [])));
}

function chargerLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // sans logo plutôt que sans reçu
    img.src = LOGO;
  });
}

function police(ctx: Ctx, css: string, espacement = 0): void {
  ctx.font = css;
  // letterSpacing : Chrome 99+, Safari 17+ ; ignoré ailleurs (sans gravité)
  if ("letterSpacing" in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${espacement}px`;
}

/**
 * Écrit `texte` sans dépasser `max` : réduit la taille jusqu'à 75 %, puis
 * coupe avec « … ». `css(taille)` donne la police pour une taille.
 */
function ecrire(
  ctx: Ctx,
  texte: string,
  x: number,
  y: number,
  max: number,
  taille: number,
  css: (t: number) => string,
  espacement = 0,
): number {
  let t = taille;
  police(ctx, css(t), espacement);
  while (ctx.measureText(texte).width > max && t > taille * 0.75) {
    t -= 0.5;
    police(ctx, css(t), espacement);
  }
  let s = texte;
  while (ctx.measureText(s).width > max && s.length > 1) s = s.slice(0, -2) + "…";
  ctx.fillText(s, x, y);
  return ctx.measureText(s).width;
}

function rectArrondi(ctx: Ctx, x: number, y: number, l: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + l, y, x + l, y + h, r);
  ctx.arcTo(x + l, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + l, y, r);
  ctx.closePath();
}

function bandeOr(ctx: Ctx, y: number): void {
  const g = ctx.createLinearGradient(0, 0, LARGEUR, 0);
  g.addColorStop(0, C.orFonce);
  g.addColorStop(0.5, C.orClair);
  g.addColorStop(1, C.orFonce);
  ctx.fillStyle = g;
  ctx.fillRect(0, y, LARGEUR, 4);
}

/** Écrit des morceaux de styles différents sur une ligne, centrés. */
function ligneCentree(ctx: Ctx, y: number, morceaux: { texte: string; css: string; couleur: string }[]): void {
  const largeurs = morceaux.map((m) => {
    police(ctx, m.css);
    return ctx.measureText(m.texte).width;
  });
  let x = LARGEUR / 2 - largeurs.reduce((a, b) => a + b, 0) / 2;
  ctx.textAlign = "left";
  morceaux.forEach((m, i) => {
    police(ctx, m.css);
    ctx.fillStyle = m.couleur;
    ctx.fillText(m.texte, x, y);
    x += largeurs[i];
  });
}

/** Dessine le reçu et renvoie le JPG. */
export async function dessinerRecu(recu: Recu): Promise<Blob> {
  const [, logo] = await Promise.all([chargerPolices(), chargerLogo()]);

  const toile = document.createElement("canvas");
  toile.width = LARGEUR * ECHELLE;
  toile.height = HAUTEUR_MAX * ECHELLE;
  const ctx = toile.getContext("2d");
  if (!ctx) throw new Error("Dessin impossible dans ce navigateur.");
  ctx.scale(ECHELLE, ECHELLE);
  ctx.textBaseline = "alphabetic";

  // ── Fond ────────────────────────────────────────────────────────────────
  ctx.fillStyle = C.fond;
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR_MAX);
  const halo = ctx.createRadialGradient(LARGEUR / 2, 0, 0, LARGEUR / 2, 0, 420);
  halo.addColorStop(0, "rgba(201,168,76,0.12)");
  halo.addColorStop(1, "rgba(201,168,76,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, LARGEUR, 420);
  bandeOr(ctx, 0);

  // ── En-tête : logo à gauche, titre / numéro / date à droite ──────────────
  if (logo) ctx.drawImage(logo, 16, 12, 104, 104);
  const droite = LARGEUR - MARGE;
  ctx.textAlign = "right";
  ctx.fillStyle = C.or;
  ecrire(ctx, "REÇU DE PAIEMENT", droite, 56, 340, 25, (t) => `700 ${t}px ${SERIF}`, 1.5);
  ctx.fillStyle = C.gris;
  ecrire(ctx, `N° ${recu.numero}`, droite, 76, 340, 10.5, (t) => `400 ${t}px ${SANS}`);
  ctx.fillStyle = C.texte;
  ecrire(ctx, recu.date, droite, 93, 340, 12, (t) => `500 ${t}px ${SANS}`);

  const filet = ctx.createLinearGradient(MARGE, 0, droite, 0);
  filet.addColorStop(0, "rgba(201,168,76,0)");
  filet.addColorStop(0.5, C.or);
  filet.addColorStop(1, "rgba(201,168,76,0)");
  ctx.fillStyle = filet;
  ctx.fillRect(MARGE, 117, UTILE, 1);

  // ── Pastille « PAIEMENT REÇU » ──────────────────────────────────────────
  police(ctx, `700 12px ${SANS}`, 1.44);
  const libellePastille = "PAIEMENT REÇU";
  const lPastille = 14 + 14 + 7 + ctx.measureText(libellePastille).width + 14;
  const xPastille = LARGEUR / 2 - lPastille / 2;
  rectArrondi(ctx, xPastille, 133, lPastille, 28, 14);
  ctx.fillStyle = "rgba(34,197,94,0.10)";
  ctx.fill();
  ctx.strokeStyle = "rgba(34,197,94,0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.save();
  ctx.translate(xPastille + 14, 140);
  ctx.scale(14 / 24, 14 / 24);
  ctx.beginPath();
  ctx.moveTo(20, 6);
  ctx.lineTo(9, 17);
  ctx.lineTo(4, 12);
  ctx.strokeStyle = C.vert;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
  ctx.textAlign = "left";
  ctx.fillStyle = C.vert;
  police(ctx, `700 12px ${SANS}`, 1.44);
  ctx.fillText(libellePastille, xPastille + 14 + 14 + 7, 151.5);

  // ── Montant ─────────────────────────────────────────────────────────────
  police(ctx, `700 46px ${SANS}`, -0.5);
  const lSomme = ctx.measureText(recu.montant).width;
  police(ctx, `600 18px ${SANS}`);
  const lDevise = ctx.measureText("FCFA").width;
  const xSomme = LARGEUR / 2 - (lSomme + 7 + lDevise) / 2;
  police(ctx, `700 46px ${SANS}`, -0.5);
  ctx.fillStyle = C.texte;
  ctx.fillText(recu.montant, xSomme, 217);
  police(ctx, `600 18px ${SANS}`);
  ctx.fillStyle = C.or;
  ctx.fillText("FCFA", xSomme + lSomme + 7, 217);
  ctx.textAlign = "center";
  ctx.fillStyle = C.gris;
  ecrire(ctx, recu.moyen, LARGEUR / 2, 241, UTILE, 13, (t) => `400 ${t}px ${SANS}`);

  // ── Encadré de l'abonnement ─────────────────────────────────────────────
  const yOffre = 261;
  const xTexte = MARGE + 18;
  const lTexte = UTILE - 36;
  let yBas = yOffre + 68;
  if (recu.periode) yBas += 26;
  if (recu.mention) yBas += 24;
  const hOffre = yBas - yOffre + 21;
  rectArrondi(ctx, MARGE, yOffre, UTILE, hOffre, 14);
  const fondOffre = ctx.createLinearGradient(MARGE, yOffre, MARGE + UTILE, yOffre + hOffre);
  fondOffre.addColorStop(0, "rgba(201,168,76,0.16)");
  fondOffre.addColorStop(1, "rgba(201,168,76,0.04)");
  ctx.fillStyle = fondOffre;
  ctx.fill();
  ctx.strokeStyle = "rgba(201,168,76,0.55)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.fillStyle = C.orClair;
  police(ctx, `700 10.5px ${SANS}`, 1.68);
  ctx.fillText("VOTRE ABONNEMENT", xTexte, yOffre + 29);
  police(ctx, `700 30px ${SERIF}`, 1.2);
  ctx.fillStyle = C.or;
  ctx.fillText(recu.niveau, xTexte, yOffre + 68);
  const lNiveau = ctx.measureText(recu.niveau).width;
  police(ctx, `600 17px ${SANS}`);
  ctx.fillStyle = C.texte;
  ctx.fillText(recu.duree, xTexte + lNiveau + 12, yOffre + 68);
  let y = yOffre + 68;
  if (recu.periode) {
    y += 26;
    ctx.fillStyle = C.texte;
    ecrire(ctx, recu.periode, xTexte, y, lTexte, 15, (t) => `600 ${t}px ${SANS}`);
  }
  if (recu.mention) {
    y += 24;
    ctx.fillStyle = C.orClair;
    ecrire(ctx, recu.mention, xTexte, y, lTexte, 12, (t) => `400 ${t}px ${SANS}`);
  }

  // ── Tableau des détails ─────────────────────────────────────────────────
  y = yOffre + hOffre + 16;
  for (const ligne of recu.lignes) {
    police(ctx, `400 13px ${SANS}`);
    ctx.textAlign = "left";
    ctx.fillStyle = C.gris;
    ctx.fillText(ligne.libelle, MARGE, y + 21);
    const lLibelle = ctx.measureText(ligne.libelle).width;
    ctx.textAlign = "right";
    ctx.fillStyle = C.texte;
    ecrire(
      ctx,
      ligne.valeur,
      droite,
      y + 21,
      UTILE - lLibelle - 16,
      ligne.code ? 12.5 : 13,
      (t) => (ligne.code ? `600 ${t}px ${MONO}` : `600 ${t}px ${SANS}`),
    );
    y += 32.5;
    ctx.fillStyle = C.trait;
    ctx.fillRect(MARGE, y - 1, UTILE, 1);
  }

  // ── Note ────────────────────────────────────────────────────────────────
  y += 14;
  const hNote = 16 + recu.note.length * 18 + 7;
  rectArrondi(ctx, MARGE, y, UTILE, hNote, 10);
  ctx.fillStyle = C.carte;
  ctx.fill();
  ctx.strokeStyle = C.trait;
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = C.texte;
  recu.note.forEach((l, i) => {
    ecrire(ctx, l, LARGEUR / 2, y + 25 + i * 18, UTILE - 28, 12.5, (t) => `400 ${t}px ${SANS}`);
  });
  y += hNote;

  // ── Pied ────────────────────────────────────────────────────────────────
  y += 42;
  ctx.fillStyle = C.or;
  police(ctx, `italic 400 15px ${SERIF}`);
  ctx.fillText("Merci de votre confiance.", LARGEUR / 2, y);
  ligneCentree(ctx, y + 22, [
    { texte: "Elite Turf", css: `600 11px ${SANS}`, couleur: C.texte },
    { texte: " · elite-turf.fr", css: `400 11px ${SANS}`, couleur: C.gris },
  ]);
  ligneCentree(ctx, y + 39, [
    { texte: "Service client WhatsApp : ", css: `400 11px ${SANS}`, couleur: C.gris },
    { texte: numeroWhatsappLisible(), css: `600 11px ${SANS}`, couleur: C.texte },
  ]);
  const hauteur = Math.min(HAUTEUR_MAX, Math.ceil(y + 39 + 22 + 4));
  bandeOr(ctx, hauteur - 4);

  // ── Recadrage à la hauteur du contenu, puis JPG ─────────────────────────
  const finale = document.createElement("canvas");
  finale.width = LARGEUR * ECHELLE;
  finale.height = hauteur * ECHELLE;
  const ctxFinal = finale.getContext("2d");
  if (!ctxFinal) throw new Error("Dessin impossible dans ce navigateur.");
  ctxFinal.drawImage(toile, 0, 0, finale.width, finale.height, 0, 0, finale.width, finale.height);
  return new Promise((resolve, reject) => {
    finale.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Export JPG impossible."))), "image/jpeg", 0.92);
  });
}

/**
 * Télécharge le JPG. Le lien n'est pas attaché à la page : les écouteurs de
 * clic (GTM / GA4) ne le voient pas.
 */
export function telechargerJpg(blob: Blob, nomFichier: string): void {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
