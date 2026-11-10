"use client";

/**
 * « Inscrire un abonné sans e-mail (WhatsApp) » — /admin/utilisateurs.
 *
 * Pour un abonné qui paie par Orange Money / Wave sans avoir d'e-mail
 * (décisions de Steph du 10/11/2026). Deux temps, comme l'activation :
 * « Vérifier » (aucune écriture : adresse technique générée, comptes qui
 * portent déjà ce numéro ou ce nom), puis « Créer le compte ». Ensuite,
 * « Activer son paiement » pré-remplit le formulaire d'activation.
 * Route : POST /api/admin/abonnes/inscrire-sans-email.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Loader2, Check, AlertTriangle, ChevronDown } from "lucide-react";
import { PAYS_OPTIONS, INDICATIF_BY_PAYS, estPrefixSeul } from "@/lib/utils/pays";

type Phase = "saisie" | "envoi" | "apercu" | "fait";

interface Saisie {
  prenom: string;
  nom: string;
  telephone: string;
  autreTelephone: string;
  pays: string;
}

interface CompteExistant {
  nom: string | null;
  email: string | null;
  statut: string | null;
}

interface Resume {
  membre: { nomComplet: string; adresse: string; telephone: string; autreTelephone: string | null; pays: string | null };
  comptesMemeNumero: CompteExistant[];
  avertissements: string[];
  etapes?: { compte: { ok: boolean }; profil: { ok: boolean; erreur?: string; note?: string } };
}

const champ =
  "w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-gold-primary/60";

export default function InscrireSansEmail({ onActiver }: { onActiver: (email: string) => void }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);

  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [pays, setPays] = useState("");
  const [telephone, setTelephone] = useState("");
  const [autreTelephone, setAutreTelephone] = useState("");

  const [phase, setPhase] = useState<Phase>("saisie");
  const [resume, setResume] = useState<Resume | null>(null);
  const [verifie, setVerifie] = useState<Saisie | null>(null);
  const [erreur, setErreur] = useState("");

  function choisirPays(valeur: string) {
    setPays(valeur);
    // Comme à l'inscription : l'indicatif est pré-rempli tant qu'aucun chiffre n'est tapé.
    const indicatif = INDICATIF_BY_PAYS[valeur];
    if (indicatif && estPrefixSeul(telephone)) setTelephone(`${indicatif} `);
  }

  async function appeler(saisie: Saisie, extra: Record<string, boolean>) {
    const res = await fetch("/api/admin/abonnes/inscrire-sans-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...saisie, ...extra }),
    });
    const data = await res.json().catch(() => null);
    return { res, data };
  }

  async function verifier(e: React.FormEvent) {
    e.preventDefault();
    const saisie: Saisie = { prenom, nom, telephone, autreTelephone, pays };
    setErreur("");
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
  async function creer() {
    if (!verifie || !resume) return;
    setErreur("");
    setPhase("envoi");
    const verifierAvant = "vérifiez dans la liste si le compte a été créé avant de réessayer.";
    try {
      const { res, data } = await appeler(verifie, { numeroConfirme: resume.comptesMemeNumero.length > 0 });
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
    setResume(null);
    setVerifie(null);
  }

  function recommencer() {
    setPrenom("");
    setNom("");
    setPays("");
    setTelephone("");
    setAutreTelephone("");
    modifier();
  }

  const occupe = phase === "envoi";
  const memeNumero = resume?.comptesMemeNumero ?? [];

  return (
    <section className="card-base p-5" aria-labelledby="inscrire-sans-email">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="flex w-full items-start gap-3 text-left"
      >
        <UserPlus className="w-5 h-5 text-gold-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
        <span className="flex-1">
          <span id="inscrire-sans-email" className="block font-serif text-lg font-bold text-text-primary">
            Inscrire un abonné sans e-mail (WhatsApp)
          </span>
          <span className="block text-text-muted text-xs mt-0.5">
            Crée son compte avec une adresse technique prenom.nom@elite-turf.fr : aucun e-mail ne lui est envoyé,
            il est suivi sur WhatsApp. Ensuite, activez son paiement avec le formulaire ci-dessus.
          </span>
        </span>
        <ChevronDown
          className={`w-5 h-5 text-text-muted flex-shrink-0 transition-transform ${ouvert ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {ouvert && (phase === "saisie" || (phase === "envoi" && !resume)) && (
        <form onSubmit={verifier} className="mt-4">
          <fieldset disabled={occupe} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 disabled:opacity-70">
            <label className="block">
              <span className="block text-text-secondary text-xs mb-1">Prénom</span>
              <input type="text" required maxLength={60} value={prenom} onChange={(e) => setPrenom(e.target.value)} className={champ} />
            </label>
            <label className="block">
              <span className="block text-text-secondary text-xs mb-1">Nom</span>
              <input type="text" required maxLength={60} value={nom} onChange={(e) => setNom(e.target.value)} className={champ} />
            </label>
            <label className="block">
              <span className="block text-text-secondary text-xs mb-1">Pays</span>
              <select value={pays} onChange={(e) => choisirPays(e.target.value)} className={champ}>
                <option value="">—</option>
                {PAYS_OPTIONS.map((p) => (
                  <option key={p.nom} value={p.nom}>
                    {p.nom}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-text-secondary text-xs mb-1">Numéro WhatsApp (avec l&apos;indicatif)</span>
              <input
                type="tel"
                required
                maxLength={40}
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="+226 …"
                className={champ}
              />
            </label>
            <label className="block">
              <span className="block text-text-secondary text-xs mb-1">Autre numéro, pour les appels (facultatif)</span>
              <input
                type="tel"
                maxLength={40}
                value={autreTelephone}
                onChange={(e) => setAutreTelephone(e.target.value)}
                className={champ}
              />
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

      {ouvert && resume && (phase === "apercu" || (phase === "envoi" && resume) || phase === "fait") && (
        <div className="mt-4 rounded-xl border border-border bg-bg-elevated/60 p-4 space-y-3">
          <ul className="text-sm text-text-secondary space-y-1">
            <li>
              {phase === "fait" ? "Compte créé" : "Compte à créer"} :{" "}
              <span className="text-text-primary font-semibold">{resume.membre.nomComplet}</span> ·{" "}
              <span className="text-text-primary">{resume.membre.adresse}</span>
            </li>
            <li>
              WhatsApp : {resume.membre.telephone}
              {resume.membre.autreTelephone ? ` · autre numéro : ${resume.membre.autreTelephone}` : ""}
              {resume.membre.pays ? ` · ${resume.membre.pays}` : ""}
            </li>
            {phase !== "fait" && (
              <li>
                Mot de passe aléatoire, jamais affiché (il ne se connecte pas) · aucun e-mail · pas de SMS automatique
              </li>
            )}
          </ul>

          {phase !== "fait" && resume.avertissements.length > 0 && (
            <ul className="space-y-1">
              {resume.avertissements.map((a) => (
                <li key={a} className="flex items-start gap-1.5 text-status-partial text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  {a}
                </li>
              ))}
            </ul>
          )}

          {phase !== "fait" && memeNumero.length > 0 && (
            <div className="rounded-lg border border-status-partial/40 p-3 space-y-2">
              <p className="flex items-start gap-1.5 text-status-partial text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                Ce numéro est déjà celui d&apos;un compte. Même abonné : activez ce compte-là plutôt que d&apos;en créer un
                second.
              </p>
              <ul className="space-y-1">
                {memeNumero.map((c, i) => (
                  <li key={`${c.email}-${i}`} className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
                    <span>
                      {c.nom || "—"} · {c.email || "sans e-mail"} · {c.statut || "GRATUIT"}
                    </span>
                    {c.email && (
                      <button
                        type="button"
                        onClick={() => onActiver(c.email as string)}
                        className="px-2 py-1 rounded border border-border text-xs hover:text-text-primary transition-colors"
                      >
                        Activer ce compte
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {phase === "fait" && resume.etapes && (
            <ul className="text-sm space-y-1 border-t border-border/60 pt-3">
              {[
                { libelle: "Compte créé", e: resume.etapes.compte as { ok: boolean; erreur?: string; note?: string } },
                { libelle: "Profil enregistré (nom, WhatsApp, pays, aucun e-mail ni SMS)", e: resume.etapes.profil },
              ].map(({ libelle, e }) => (
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
                  onClick={creer}
                  disabled={occupe}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-primary hover:bg-gold-dark text-bg-primary text-sm font-bold disabled:opacity-60 transition-colors"
                >
                  {occupe && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                  {memeNumero.length > 0 ? "C'est une autre personne : créer le compte" : "Créer le compte"}
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
              <>
                <button
                  type="button"
                  onClick={() => onActiver(resume.membre.adresse)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-primary hover:bg-gold-dark text-bg-primary text-sm font-bold transition-colors"
                >
                  Activer son paiement
                </button>
                <button
                  type="button"
                  onClick={recommencer}
                  className="px-4 py-2 rounded-lg border border-border text-text-secondary text-sm hover:text-text-primary transition-colors"
                >
                  Nouvelle inscription
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
