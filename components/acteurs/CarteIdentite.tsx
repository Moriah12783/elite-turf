/**
 * Carte d'identité visuelle d'un acteur (cheval/jockey/entraîneur).
 *
 * Sections modulaires : chaque ligne est rendue uniquement si la donnée
 * est disponible. Conçu pour rester rétro-compatible avec la Phase 2 :
 * quand le scraper Geny peuplera pedigree/propriétaire/robe/etc., les
 * sections apparaissent automatiquement sans refactor.
 *
 * Phase 1 (mai 2026) : affiche les données existantes (sexe, âge, statut
 * dérivé) avec un design premium pour booster la perception de qualité.
 */

import type { ReactNode } from "react";
import {
  Info, Users, Award, MapPin, Calendar as CalendarIcon,
  Activity, Pause, ExternalLink,
} from "lucide-react";
import type { Entite, EntiteType, RichStats } from "@/lib/seo/acteurs";
import { formatSexeCheval } from "@/lib/seo/acteurs";

interface Props {
  type:   EntiteType;
  entite: Entite;
  stats:  RichStats;
}

function Row({
  icon, label, value, accent = false,
}: {
  icon:   ReactNode;
  label:  string;
  value:  ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-0">
      <span className="flex items-center gap-2 text-text-muted text-xs uppercase tracking-wider">
        {icon}
        {label}
      </span>
      <span className={accent
        ? "text-gold-light text-sm font-bold text-right"
        : "text-text-primary text-sm font-medium text-right"}>
        {value}
      </span>
    </div>
  );
}

function StatutBadge({ statut }: { statut: RichStats["statut"] }) {
  if (statut === "actif") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-status-win/15 text-status-win border border-status-win/30 text-xs font-bold">
        <Activity className="w-3 h-3" />
        Actif
      </span>
    );
  }
  if (statut === "au_repos") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-bg-elevated text-text-muted border border-border text-xs font-bold">
        <Pause className="w-3 h-3" />
        Au repos
      </span>
    );
  }
  return <span className="text-text-muted text-xs">—</span>;
}

export default function CarteIdentite({ type, entite, stats }: Props) {
  // ── Champs Phase 2 (peuplés par scraper Geny quand colonnes BDD ajoutées) ──
  const hasPedigree    = Boolean(entite.pere_nom || entite.mere_nom);
  const hasProprio     = Boolean(entite.proprietaire);
  const hasEleveur     = Boolean(entite.eleveur);
  const hasEcurie      = Boolean(entite.ecurie);
  const hasRobe        = Boolean(entite.robe);
  const hasNaissance   = Boolean(entite.date_naissance);
  const hasPaysOrigine = Boolean(entite.pays_origine);
  const hasGains       = typeof entite.gains_totaux_eur === "number";
  const hasGenyUrl     = Boolean(entite.geny_url);

  return (
    <section className="card-base p-5 sm:p-6">
      <h2 className="font-serif font-bold text-text-primary text-lg mb-4 flex items-center gap-2">
        <Info className="w-5 h-5 text-gold-primary" />
        Carte d&apos;identité
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
        {/* ── Colonne 1 : Profil ── */}
        <div>
          {type === "chevaux" && entite.sexe && (
            <Row
              icon={<Award className="w-3 h-3" />}
              label="Sexe"
              value={formatSexeCheval(entite.sexe)}
            />
          )}
          {type === "chevaux" && entite.age && (
            <Row
              icon={<CalendarIcon className="w-3 h-3" />}
              label="Âge"
              value={`${entite.age} ans`}
            />
          )}
          {hasNaissance && (
            <Row
              icon={<CalendarIcon className="w-3 h-3" />}
              label="Naissance"
              value={entite.date_naissance!}
            />
          )}
          {hasRobe && (
            <Row
              icon={<Award className="w-3 h-3" />}
              label="Robe"
              value={entite.robe!}
            />
          )}
          {hasPaysOrigine && (
            <Row
              icon={<MapPin className="w-3 h-3" />}
              label="Pays"
              value={entite.pays_origine!}
            />
          )}
          <Row
            icon={<Activity className="w-3 h-3" />}
            label="Statut"
            value={<StatutBadge statut={stats.statut} />}
          />
          {stats.jours_derniere_course !== null && (
            <Row
              icon={<CalendarIcon className="w-3 h-3" />}
              label="Dernière course"
              value={
                stats.jours_derniere_course === 0
                  ? "Aujourd'hui"
                  : stats.jours_derniere_course === 1
                  ? "Hier"
                  : `Il y a ${stats.jours_derniere_course} j`
              }
            />
          )}
        </div>

        {/* ── Colonne 2 : Entourage + Pedigree (Phase 2) ── */}
        <div>
          {hasPedigree && (
            <Row
              icon={<Users className="w-3 h-3" />}
              label="Pedigree"
              value={
                <span className="text-xs">
                  {entite.pere_nom}
                  {entite.mere_nom && <span className="text-text-muted"> × {entite.mere_nom}</span>}
                </span>
              }
            />
          )}
          {hasProprio && (
            <Row
              icon={<Users className="w-3 h-3" />}
              label="Propriétaire"
              value={entite.proprietaire!}
            />
          )}
          {hasEleveur && (
            <Row
              icon={<Users className="w-3 h-3" />}
              label="Éleveur"
              value={entite.eleveur!}
            />
          )}
          {hasEcurie && (
            <Row
              icon={<MapPin className="w-3 h-3" />}
              label="Écurie"
              value={entite.ecurie!}
            />
          )}
          {hasGains && (
            <Row
              icon={<Award className="w-3 h-3" />}
              label="Gains totaux"
              value={
                <span className="text-gold-light font-bold">
                  {entite.gains_totaux_eur!.toLocaleString("fr-FR")} €
                </span>
              }
              accent
            />
          )}
          {/* Partenaire principal (jockey préféré pour cheval, cheval favori pour jockey) */}
          {stats.partenaires_freq.length > 0 && (
            <Row
              icon={<Users className="w-3 h-3" />}
              label={type === "chevaux" ? "Jockey privilégié" : "Cheval favori"}
              value={
                <span className="text-xs">
                  {stats.partenaires_freq[0][0]}
                  <span className="text-text-muted ml-1">
                    ({stats.partenaires_freq[0][1]} c.)
                  </span>
                </span>
              }
            />
          )}
        </div>
      </div>

      {/* ── Lien fiche complète Geny (Phase 2 ou fallback manuel) ── */}
      {hasGenyUrl && (
        <div className="mt-5 pt-4 border-t border-border/40">
          <a
            href={entite.geny_url!}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-2 text-xs text-text-muted hover:text-gold-light transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Fiche complète sur Geny.com
          </a>
        </div>
      )}
    </section>
  );
}
