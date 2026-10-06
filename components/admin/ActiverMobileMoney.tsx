"use client";

/**
 * « Activer un paiement Orange Money / Wave » — /admin/utilisateurs.
 *
 * Deux temps, comme le bouton « ✉ Confirmation » : « Vérifier » appelle la
 * route en APERÇU (rien n'est écrit) et affiche ce qui va se passer ;
 * « Confirmer » active l'accès, enregistre le paiement et envoie l'e-mail.
 * Route : POST /api/admin/abonnements/activer-mobile-money.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Smartphone, Loader2, Check, AlertTriangle } from "lucide-react";
import { formulesMobileMoney, montantMobileMoney, PAYS_MOBILE_MONEY } from "@/lib/paiement/mobile-money";
import { OPERATEURS, type Operateur } from "@/lib/paiement/activation-mobile-money";

type Phase = "saisie" | "envoi" | "apercu" | "fait";

interface Etape {
  ok: boolean;
  erreur?: string | null;
  note?: string | null;
  nonDemande?: boolean;
  journalise?: boolean;
  erreurJournal?: string | null;
}

/** Ce qui a été vérifié — et donc exactement ce qui sera activé. */
interface Saisie {
  email: string;
  formule: string;
  operateur: Operateur;
  pays: string | null;
  reference: string;
  envoyerEmail: boolean;
}

interface Resume {
  membre: { nom: string | null; email: string };
  actuel: { statut: string | null; expirationLisible: string | null };
  nouveau: { statut: string; formule: string; dureeJours: number; finLisible: string; prolongation: boolean };
  paiement: { montantFcfa: number; operateurLibelle: string; pays: string | null; reference: string | null };
  envoyerEmail: boolean;
  avertissements: string[];
  reference?: string;
  etapes?: { acces: Etape; abonnement: Etape; paiement: Etape; email: Etape };
}

const champ =
  "w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-gold-primary/60";

function fcfa(n: number): string {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

function nomPays(code: string | null): string | null {
  return PAYS_MOBILE_MONEY.find((p) => p.code === code)?.nom ?? null;
}

export default function ActiverMobileMoney() {
  const router = useRouter();
  const formules = formulesMobileMoney();

  const [email, setEmail] = useState("");
  const [formule, setFormule] = useState("pro");
  const [operateur, setOperateur] = useState<Operateur>("ORANGE_MONEY");
  const [pays, setPays] = useState("");
  const [reference, setReference] = useState("");
  const [envoyerEmail, setEnvoyerEmail] = useState(true);

  const [phase, setPhase] = useState<Phase>("saisie");
  const [resume, setResume] = useState<Resume | null>(null);
  const [verifie, setVerifie] = useState<Saisie | null>(null);
  const [erreur, setErreur] = useState("");
  const [doublon, setDoublon] = useState(false);

  async function appeler(saisie: Saisie, extra: Record<string, boolean>) {
    const res = await fetch("/api/admin/abonnements/activer-mobile-money", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...saisie, ...extra }),
    });
    const data = await res.json().catch(() => null);
    return { res, data };
  }

  async function verifier(e: React.FormEvent) {
    e.preventDefault();
    const saisie: Saisie = { email, formule, operateur, pays: pays || null, reference, envoyerEmail };
    setErreur("");
    setDoublon(false);
    setPhase("envoi");
    try {
      const { res, data } = await appeler(saisie, { apercu: true });
      if (!res.ok || !data) {
        setErreur(data?.error || `Échec (HTTP ${res.status})`);
        setPhase("saisie");
        return;
      }
      setVerifie(saisie);
      setResume(data);
      setPhase("apercu");
    } catch {
      setErreur("Erreur réseau");
      setPhase("saisie");
    }
  }

  // Envoie EXACTEMENT la saisie vérifiée, jamais l'état courant du formulaire.
  async function activer(doublonConfirme: boolean) {
    if (!verifie) return;
    setErreur("");
    setPhase("envoi");
    const verifierAvant =
      "vérifiez dans la liste (statut de l'abonné) et dans Admin → Paiements si l'activation a eu lieu avant de réessayer.";
    try {
      const { res, data } = await appeler(verifie, { doublonConfirme });
      if (res.status === 409 && data?.doublon) {
        setDoublon(true);
        setErreur(data.error);
        setPhase("apercu");
        return;
      }
      if (!res.ok || !data) {
        setErreur(
          res.status >= 500 || !data
            ? `Réponse inattendue du serveur (HTTP ${res.status}${data?.error ? ` : ${data.error}` : ""}) — ${verifierAvant}`
            : data.error || `Échec (HTTP ${res.status})`,
        );
        setPhase("apercu");
        return;
      }
      setResume(data);
      setPhase("fait");
      router.refresh();
    } catch {
      setErreur(`Erreur réseau — ${verifierAvant}`);
      setPhase("apercu");
    }
  }

  function modifier() {
    setPhase("saisie");
    setErreur("");
    setDoublon(false);
    setResume(null);
    setVerifie(null);
  }

  function recommencer() {
    setEmail("");
    setReference("");
    modifier();
  }

  const occupe = phase === "envoi";

  return (
    <section className="card-base p-5" aria-labelledby="activer-mobile-money">
      <div className="flex items-start gap-3 mb-4">
        <Smartphone className="w-5 h-5 text-gold-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <h2 id="activer-mobile-money" className="font-serif text-lg font-bold text-text-primary">
            Activer un paiement Orange Money / Wave
          </h2>
          <p className="text-text-muted text-xs mt-0.5">
            Après réception du paiement : accès activé, paiement enregistré, e-mail de confirmation envoyé. Un abonné
            encore actif garde ses jours restants : la nouvelle période s&apos;ajoute après sa date de fin.
          </p>
        </div>
      </div>

      {(phase === "saisie" || (phase === "envoi" && !resume)) && (
        <form onSubmit={verifier}>
          {/* Champs bloqués pendant la vérification : ce qui est vérifié est
              exactement ce qui sera confirmé. */}
          <fieldset disabled={occupe} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 disabled:opacity-70">
          <label className="block sm:col-span-2 lg:col-span-1">
            <span className="block text-text-secondary text-xs mb-1">E-mail du compte de l&apos;abonné</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={champ} />
          </label>
          <label className="block">
            <span className="block text-text-secondary text-xs mb-1">Formule payée</span>
            <select value={formule} onChange={(e) => setFormule(e.target.value)} className={champ}>
              {formules.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom} — {montantMobileMoney(p)} · {p.duree_jours} jours
                </option>
              ))}
            </select>
          </label>
          <fieldset className="block">
            <legend className="block text-text-secondary text-xs mb-1">Opérateur</legend>
            <div className="flex gap-2">
              {(Object.keys(OPERATEURS) as Operateur[]).map((op) => (
                <label key={op} className="flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="operateur"
                    value={op}
                    checked={operateur === op}
                    onChange={() => setOperateur(op)}
                    className="peer sr-only"
                  />
                  <span className="block rounded-lg border border-border bg-bg-elevated px-3 py-2 text-center text-sm text-text-secondary peer-checked:border-gold-primary peer-checked:bg-gold-faint peer-checked:text-gold-light peer-focus-visible:ring-2 peer-focus-visible:ring-gold-primary/60">
                    {OPERATEURS[op]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="block text-text-secondary text-xs mb-1">Pays (facultatif)</span>
            <select value={pays} onChange={(e) => setPays(e.target.value)} className={champ}>
              <option value="">—</option>
              {PAYS_MOBILE_MONEY.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.nom}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-text-secondary text-xs mb-1">Référence du paiement (facultatif)</span>
            <input
              type="text"
              maxLength={100}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="ID de la transaction Orange Money / Wave"
              className={champ}
            />
          </label>
          <label className="flex items-center gap-2 text-text-secondary text-sm sm:col-span-2 lg:col-span-1 self-end pb-2">
            <input
              type="checkbox"
              checked={envoyerEmail}
              onChange={(e) => setEnvoyerEmail(e.target.checked)}
              className="w-4 h-4 accent-gold-primary"
            />
            Envoyer l&apos;e-mail de confirmation
          </label>
          <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={occupe}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-primary hover:bg-gold-dark text-bg-primary text-sm font-bold disabled:opacity-60 transition-colors"
            >
              {occupe && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Vérifier
            </button>
            {erreur && (
              <span className="inline-flex items-start gap-1.5 text-status-loss text-sm" role="alert">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                {erreur}
              </span>
            )}
          </div>
          </fieldset>
        </form>
      )}

      {resume && (phase === "apercu" || (phase === "envoi" && resume) || phase === "fait") && (
        <div className="rounded-xl border border-border bg-bg-elevated/60 p-4 space-y-3">
          <div>
            <p className="text-text-primary text-sm font-semibold">
              {resume.membre.nom || "—"} <span className="text-text-muted font-normal">· {resume.membre.email}</span>
            </p>
            <p className="text-text-muted text-xs mt-0.5">
              Actuellement : {resume.actuel.statut ?? "GRATUIT"}
              {resume.actuel.expirationLisible ? ` jusqu'au ${resume.actuel.expirationLisible}` : ""}
            </p>
          </div>

          <ul className="text-sm text-text-secondary space-y-1">
            <li>
              {phase === "fait" ? "Activé" : "Après activation"} :{" "}
              <span className="text-text-primary font-semibold">
                {resume.nouveau.statut} jusqu&apos;au {resume.nouveau.finLisible}
              </span>
              {resume.nouveau.prolongation
                ? ` (${resume.nouveau.dureeJours} jours ajoutés après sa date de fin actuelle)`
                : ` (${resume.nouveau.dureeJours} jours à partir de maintenant)`}
            </li>
            <li>
              Paiement {phase === "fait" ? "" : "à enregistrer "}: {fcfa(resume.paiement.montantFcfa)} ·{" "}
              {resume.paiement.operateurLibelle}
              {nomPays(resume.paiement.pays) ? ` · ${nomPays(resume.paiement.pays)}` : ""}
              {resume.paiement.reference ? ` · réf. ${resume.paiement.reference}` : ""}
            </li>
            {phase !== "fait" && (
              <li>
                E-mail de confirmation :{" "}
                {resume.envoyerEmail ? `sera envoyé à ${resume.membre.email}` : "non envoyé (case décochée)"}
              </li>
            )}
          </ul>

          {resume.avertissements.length > 0 && phase !== "fait" && (
            <ul className="space-y-1">
              {resume.avertissements.map((a) => (
                <li key={a} className="flex items-start gap-1.5 text-status-partial text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  {a}
                </li>
              ))}
            </ul>
          )}

          {phase === "fait" && resume.etapes && (
            <ul className="text-sm space-y-1 border-t border-border/60 pt-3">
              {[
                { libelle: "Accès activé", e: resume.etapes.acces },
                { libelle: `Abonnement enregistré`, e: resume.etapes.abonnement },
                { libelle: `Paiement enregistré (${resume.reference})`, e: resume.etapes.paiement },
                { libelle: "E-mail de confirmation envoyé", e: resume.etapes.email },
              ]
                .filter(({ e }) => !e.nonDemande)
                .map(({ libelle, e }) => (
                  <li key={libelle} className={`flex items-start gap-1.5 ${e.ok ? "text-status-win" : "text-status-loss"}`}>
                    {e.ok ? (
                      <Check className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    )}
                    <span>
                      {libelle}
                      {e.ok ? "" : ` : échec (${e.erreur ?? "raison inconnue"})`}
                      {e.ok && e.note ? ` — ${e.note}` : ""}
                      {e.ok && e.journalise === false ? ` — ⚠ non journalisé (${e.erreurJournal ?? ""})` : ""}
                    </span>
                  </li>
                ))}
            </ul>
          )}

          {erreur && phase !== "fait" && (
            <p className="flex items-start gap-1.5 text-status-loss text-sm" role="alert">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
              {erreur}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {phase !== "fait" ? (
              <>
                <button
                  type="button"
                  onClick={() => activer(doublon)}
                  disabled={occupe}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-primary hover:bg-gold-dark text-bg-primary text-sm font-bold disabled:opacity-60 transition-colors"
                >
                  {occupe && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                  {doublon ? "Oui, c'est un second paiement : activer" : "Confirmer l'activation"}
                </button>
                <button
                  type="button"
                  onClick={modifier}
                  disabled={occupe}
                  className="px-4 py-2 rounded-lg border border-border text-text-secondary text-sm hover:text-text-primary transition-colors"
                >
                  Modifier
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={recommencer}
                className="px-4 py-2 rounded-lg border border-border text-text-secondary text-sm hover:text-text-primary transition-colors"
              >
                Nouvelle activation
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
