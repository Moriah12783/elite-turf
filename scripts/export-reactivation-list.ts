/**
 * scripts/export-reactivation-list.ts
 *
 * Exporte la liste des inscrits NON-PAYANTS éligibles à la séquence de
 * réactivation (audit Sprint 1.5, Lot 4) — AVEC consentement vérifié :
 *   - statut_abonnement IN ('GRATUIT', 'EXPIRE')  → jamais les payants
 *   - email_opted_out = false                      → consentement email
 *   - (le flag sms_opted_out est exporté à titre indicatif pour le canal SMS/WABA)
 *
 * ⚠️ DRY-RUN PAR DÉFAUT : n'écrit RIEN et n'envoie RIEN — affiche un résumé.
 *    --csv : écrit tmp/reactivation-list.csv (pour validation humaine).
 *    L'ENVOI des emails/WABA est une décision humaine, HORS de ce script.
 *
 * Usage :
 *   npx tsx scripts/export-reactivation-list.ts          # dry-run (résumé)
 *   npx tsx scripts/export-reactivation-list.ts --csv    # export CSV
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// ── Charger .env.local manuellement (pattern send-test-email.ts) ──────────
function loadEnvLocal() {
  try {
    const content = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    console.error("⚠ Impossible de charger .env.local");
    process.exit(1);
  }
}
loadEnvLocal();

import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("⚠ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants dans .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const wantCsv  = process.argv.includes("--csv");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, nom_complet, phone, pays, statut_abonnement, sms_opt_in, sms_opted_out, email_opted_out, sms_unsub_token, date_inscription")
    .in("statut_abonnement", ["GRATUIT", "EXPIRE"])
    .eq("email_opted_out", false)
    .not("email", "is", null)
    .order("date_inscription", { ascending: false });

  if (error) {
    console.error("⚠ Erreur Supabase :", error.message);
    process.exit(1);
  }

  const rows = data ?? [];
  const avecPhone  = rows.filter((r) => (r.phone || "").trim()).length;
  const smsOk      = rows.filter((r) => r.sms_opt_in && !r.sms_opted_out && (r.phone || "").trim()).length;

  console.log("══════════════════════════════════════════════════════");
  console.log("  LISTE DE RÉACTIVATION — DRY-RUN (aucun envoi)");
  console.log("══════════════════════════════════════════════════════");
  console.log(`  Éligibles email (non-payants, opt-out exclus) : ${rows.length}`);
  console.log(`  ... dont avec téléphone                        : ${avecPhone}`);
  console.log(`  ... dont éligibles SMS/WABA (opt-in, non STOP) : ${smsOk}`);
  console.log("──────────────────────────────────────────────────────");
  for (const r of rows.slice(0, 10)) {
    console.log(`  · ${r.email}  (${r.pays || "?"} · ${r.statut_abonnement} · inscrit ${String(r.date_inscription).slice(0, 10)})`);
  }
  if (rows.length > 10) console.log(`  … et ${rows.length - 10} autres.`);

  if (!wantCsv) {
    console.log("──────────────────────────────────────────────────────");
    console.log("  Dry-run terminé. Pour exporter : ajouter --csv");
    return;
  }

  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = "id,email,nom_complet,phone,pays,statut_abonnement,sms_eligible,unsub_token,date_inscription";
  const lines  = rows.map((r) => [
    r.id, r.email, r.nom_complet, r.phone, r.pays, r.statut_abonnement,
    r.sms_opt_in && !r.sms_opted_out && (r.phone || "").trim() ? "oui" : "non",
    r.sms_unsub_token, String(r.date_inscription).slice(0, 10),
  ].map(esc).join(","));

  mkdirSync(join(process.cwd(), "tmp"), { recursive: true });
  const out = join(process.cwd(), "tmp", "reactivation-list.csv");
  writeFileSync(out, "﻿" + [header, ...lines].join("\n"), "utf8");
  console.log(`──────────────────────────────────────────────────────`);
  console.log(`  ✓ CSV écrit : ${out} (${rows.length} lignes)`);
  console.log(`  ⚠ Fichier local uniquement (tmp/ est gitignoré) — ne pas committer.`);
}

main();
