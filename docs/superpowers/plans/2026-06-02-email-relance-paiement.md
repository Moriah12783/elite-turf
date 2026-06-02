# E-mail « paiement échoué » (relance manuelle) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Template e-mail réutilisable « paiement échoué » + route admin manuelle pour l'envoyer à un client (ex. Hamza).

**Architecture:** Réutilise l'infra e-mail (`emailBase`/`emailButton`, bannières, `sendEmailDetailed`). Route auth Bearer `CRON_SECRET`, lookup nom via `profiles.email`.

**Tech Stack:** Next.js 14 (API route), Resend, Supabase, Vitest.

---

### Task 1 : Bannière + template + test (TDD)

**Files:** Modify `lib/email/templates/banners/header-banner.ts` · Create `lib/email/templates/paiement-echoue.ts` + `lib/email/templates/paiement-echoue.test.ts`

- [ ] **Step 1 — Bannière** : ajouter à la fin de `header-banner.ts` :
```ts
export const BANNER_PAIEMENT_ECHOUE: BannerConfig = {
  title:         "Votre paiement n'a pas abouti",
  subtitle:      "Reprenez en 1 clic — c'est rapide",
  photoFilename: "cheval-2-rose.jpg",
};
```

- [ ] **Step 2 — Test (échoue)** : `lib/email/templates/paiement-echoue.test.ts`
```ts
import { describe, it, expect } from "vitest";
import { templatePaiementEchoue } from "./paiement-echoue";

describe("templatePaiementEchoue", () => {
  it("sujet + html avec prénom, CTA /abonnements et 'aucun montant'", () => {
    const { subject, html } = templatePaiementEchoue({
      nomComplet: "Hamza Hara", email: "hamza@example.com", planNom: "Elite", montantEur: 65,
    });
    expect(subject).toContain("n'a pas abouti");
    expect(html).toContain("Hamza");
    expect(html).toContain("/abonnements");
    expect(html).toContain("aucun montant");
    expect(html).toContain("Plan Elite");
  });
  it("masque le récap sans plan ni montant", () => {
    const { html } = templatePaiementEchoue({ nomComplet: "Test User", email: "t@e.fr" });
    expect(html).not.toContain("Abonnement choisi");
  });
});
```

- [ ] **Step 3 — Run RED** : `Set-Location C:\Users\HP\etf-wt-ns-promo; npx -y vitest run lib/email/templates/paiement-echoue.test.ts` → FAIL.

- [ ] **Step 4 — Implémenter** : `lib/email/templates/paiement-echoue.ts`
```ts
import { emailBase, emailButton, emailDivider } from "../base";
import { renderHeaderBanner, BANNER_PAIEMENT_ECHOUE } from "./banners/header-banner";

interface PaiementEchoueData {
  nomComplet: string;
  email: string;
  planNom?: string;
  montantEur?: number;
}

export function templatePaiementEchoue(data: PaiementEchoueData): {
  subject: string;
  html: string;
} {
  const prenom = (data.nomComplet || "").split(" ")[0] || data.nomComplet || "cher client";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.fr";

  const hasRecap = !!data.planNom || data.montantEur != null;
  const recap = hasRecap ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#F8FAFC;border:1px solid rgba(201,168,76,0.35);border-radius:10px;margin:0 0 24px 0;">
      <tr>
        <td style="padding:18px 22px;">
          ${data.planNom ? `<p style="margin:0 0 4px 0;color:#6B7280;font-size:13px;">Abonnement choisi</p>
          <p style="margin:0 0 ${data.montantEur != null ? "12px" : "0"} 0;color:#1E3A5F;font-size:16px;font-weight:700;">Plan ${data.planNom}</p>` : ""}
          ${data.montantEur != null ? `<p style="margin:0 0 4px 0;color:#6B7280;font-size:13px;">Montant</p>
          <p style="margin:0;color:#C9A84C;font-size:16px;font-weight:700;">${data.montantEur.toFixed(2).replace(".", ",")} €</p>` : ""}
        </td>
      </tr>
    </table>` : "";

  const content = `
    ${renderHeaderBanner(BANNER_PAIEMENT_ECHOUE)}

    <p style="margin:28px 0 16px 0;color:#1F2937;font-size:14px;line-height:1.6;">
      Bonjour ${prenom}, votre paiement n'a malheureusement pas pu aboutir —
      <strong style="color:#1E3A5F;">aucun montant n'a été débité</strong>.
    </p>

    <p style="margin:0 0 20px 0;color:#4B5563;font-size:14px;line-height:1.6;">
      Cela arrive parfois (une vérification de sécurité de votre banque, une carte
      étrangère…), ce n'est pas grave. Il vous suffit de reprendre le paiement — c'est rapide.
    </p>

    ${recap}

    ${emailButton(`${appUrl}/abonnements`, "Reprendre mon paiement")}

    ${emailDivider}

    <p style="margin:0;color:#9CA3AF;font-size:12px;text-align:center;line-height:1.7;">
      Un souci persiste ? Répondez simplement à cet e-mail ou écrivez-nous à
      <a href="mailto:contact@elite-turf.fr" style="color:#C9A84C;">contact@elite-turf.fr</a> —
      nous activons votre accès rapidement.
    </p>
  `;

  return {
    subject: "Votre paiement Elite Turf n'a pas abouti — finalisez en 1 clic",
    html: emailBase(
      content,
      "Votre paiement n'a pas abouti — aucun montant débité. Reprenez en 1 clic.",
    ),
  };
}
```

- [ ] **Step 5 — Run GREEN** : même commande → PASS.

- [ ] **Step 6 — Commit** :
```bash
git add lib/email/templates/banners/header-banner.ts lib/email/templates/paiement-echoue.ts lib/email/templates/paiement-echoue.test.ts
git commit -m "feat(email): template paiement-echoue + banniere (teste)"
```

---

### Task 2 : Route admin de relance

**Files:** Create `app/api/admin/relance-paiement/route.ts`

- [ ] **Step 1 — Créer** :
```ts
/**
 * POST /api/admin/relance-paiement
 *
 * Envoie l'e-mail "paiement échoué" (relance) à un client — déclenché manuellement.
 * Auth : Bearer CRON_SECRET (admin-grade).
 *
 * Body : { email: string, nomComplet?: string, planNom?: string, montantEur?: number }
 *   - email requis. nom_complet récupéré depuis `profiles` si trouvable.
 *   - planNom/montantEur : optionnels (le plan TENTÉ n'est pas dans le profil),
 *     fournis par l'admin si connus ; sinon récap masqué.
 *
 *   curl -X POST https://www.elite-turf.fr/api/admin/relance-paiement \
 *     -H "Authorization: Bearer $CRON_SECRET" -H "Content-Type: application/json" \
 *     -d '{"email":"client@x.com","planNom":"Elite","montantEur":65}'
 */
import { NextRequest, NextResponse } from "next/server";
import { sendEmailDetailed } from "@/lib/email";
import { templatePaiementEchoue } from "@/lib/email/templates/paiement-echoue";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { email?: string; nomComplet?: string; planNom?: string; montantEur?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = (body.email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }

  // Enrichir le nom depuis le profil (best-effort). Le PLAN tenté n'est PAS dans
  // le profil (statut_abonnement = état courant) → planNom vient du body uniquement.
  let nomComplet = (body.nomComplet || "").trim();
  try {
    const supabase = createServiceClient();
    const { data: profile } = await supabase
      .from("profiles").select("nom_complet").eq("email", email).maybeSingle();
    if (!nomComplet && profile?.nom_complet) nomComplet = profile.nom_complet;
  } catch { /* best-effort : on envoie quand même */ }
  if (!nomComplet) nomComplet = "cher client";

  try {
    const { subject, html } = templatePaiementEchoue({
      nomComplet, email, planNom: body.planNom, montantEur: body.montantEur,
    });
    const result = await sendEmailDetailed({ to: email, subject, html });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error || "Échec envoi Resend" }, { status: 500 });
    }
    console.log(`[relance-paiement] ✓ → ${email}`);
    return NextResponse.json({ ok: true, email, subject });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[relance-paiement] ✗ → ${email} : ${msg}`);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2 — Commit** (avec Task 3).

---

### Task 3 : Aperçu via `email-test`

**Files:** Modify `app/api/admin/email-test/route.ts`

- [ ] **Step 1 — Import** : après les autres imports de templates :
```ts
import { templatePaiementEchoue } from "@/lib/email/templates/paiement-echoue";
```

- [ ] **Step 2 — Registry** : ajouter dans l'objet `TEMPLATES` (ex. après `"rappel-expiration"`) :
```ts
  "paiement-echoue":        (email) => templatePaiementEchoue({
    nomComplet: NOM_COMPLET, email, planNom: "Elite", montantEur: 65,
  }),
```

- [ ] **Step 3 — Typecheck** : `npx tsc --noEmit` → 0 erreur.
- [ ] **Step 4 — Tests** : `npx -y vitest run` → suite verte.
- [ ] **Step 5 — Commit** :
```bash
git add app/api/admin/relance-paiement/route.ts app/api/admin/email-test/route.ts
git commit -m "feat(email): route admin/relance-paiement + apercu email-test"
```

---

### Task 4 : PR
- [ ] Push `feat/email-relance-paiement` + `gh pr create`.
- [ ] Après déploiement : aperçu via `email-test` (`{"template":"paiement-echoue","email":"<toi>"}`), puis envoi réel à Hamza via `relance-paiement`.

---

## Self-review
- **Couverture spec** : template + banner ✓ (T1) · route manuelle auth CRON_SECRET + lookup nom ✓ (T2) · email-test ✓ (T3) · CTA /abonnements ✓ · récap optionnel ✓ · planNom depuis body (pas profil) ✓.
- **Placeholders** : aucun.
- **Cohérence** : `templatePaiementEchoue({nomComplet,email,planNom?,montantEur?})` identique en T1/T2/T3 ; `BANNER_PAIEMENT_ECHOUE` (T1) consommé par le template.
