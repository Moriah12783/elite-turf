import Link from "next/link";
import {
  ShieldCheck, Gift, Eye, BadgeCheck, Database, UserCheck, FileClock,
  MessageCircle, ChevronRight, TrendingUp, Quote, Star,
} from "lucide-react";
import { whatsappUrl } from "@/lib/constants/whatsapp";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * PreuveSection — « La preuve par les résultats ».
 *
 * Remplace l'ancienne section Témoignages (retirée — audit Sprint 1.5 Lot 1 :
 * preuve sociale inventée). Ce bloc est bâti à 100 % sur du VÉRIFIABLE :
 *   - garanties réelles (dont « 1er pronostic expert perdant = 7 jours offerts »,
 *     décision Q2 du Sprint 1.5, conditions détaillées dans la FAQ /abonnements) ;
 *   - méthodologie résumée (3 piliers) avec lien vers /methodologie ;
 *   - lien fort vers /performances (les stats réelles vivent dans StatsSection
 *     juste au-dessus — pas de doublon de KPIs ici) ;
 *   - CTA témoignage RÉEL (expérience, pas « gain ») vers WhatsApp.
 *
 * Lot 3 : les témoignages réels approuvés (table `testimonials`) s'afficheront
 * ici, sous le bandeau garanties, uniquement s'il en existe ≥ 1 approuvé.
 */

const GARANTIES = [
  {
    icon: Gift,
    titre: "1er pronostic perdant ? 7 jours offerts",
    texte:
      "Si le premier pronostic expert reçu après votre souscription est perdant, nous prolongeons votre accès de 7 jours, offerts. Conditions dans la FAQ.",
    accent: true,
  },
  {
    icon: ShieldCheck,
    titre: "Sans engagement, vous gardez le contrôle",
    texte:
      "Par défaut, aucun renouvellement automatique : vous payez une période fixe, puis vous décidez. Le renouvellement auto est une option, activable et annulable à tout moment.",
    accent: false,
  },
  {
    icon: Eye,
    titre: "Victoires ET défaites publiées",
    texte:
      "Chaque pronostic est horodaté avant la course et son résultat reste public. Aucun tri, aucun chiffre retouché.",
    accent: false,
  },
  {
    icon: BadgeCheck,
    titre: "Remboursement intégral sous 48h",
    texte:
      "Problème technique majeur dans les 24h suivant votre paiement ? Remboursement intégral sous 48h ouvrées.",
    accent: false,
  },
];

const METHODE = [
  {
    icon: Database,
    titre: "Données officielles",
    texte: "PMU France, Geny, LONACI/LONASE — programmes, cotes et arrivées synchronisés chaque jour.",
  },
  {
    icon: UserCheck,
    titre: "Validation humaine",
    texte: "Aucune sélection publiée sans relecture par notre expert : non-partants, piste, cohérence.",
  },
  {
    icon: FileClock,
    titre: "Publication horodatée",
    texte: "Chaque pronostic est daté AVANT la course — l'historique complet est consultable librement.",
  },
];

interface TemoignageApprouve {
  id: string;
  nom_affiche: string;
  ville: string | null;
  pays: string | null;
  pack: string | null;
  texte: string;
  note: number | null;
}

export default async function PreuveSection() {
  // Témoignages RÉELS approuvés (table testimonials, modérés via /admin/temoignages).
  // S'il n'y en a aucun, la grille est entièrement masquée — jamais de placeholder.
  let temoignages: TemoignageApprouve[] = [];
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("testimonials")
      .select("id, nom_affiche, ville, pays, pack, texte, note")
      .eq("statut", "approved")
      .order("approved_at", { ascending: false })
      .limit(6);
    temoignages = (data ?? []) as TemoignageApprouve[];
  } catch {
    temoignages = [];
  }

  return (
    <section className="relative py-16 sm:py-20 overflow-hidden bg-bg-card/30 border-y border-border/30">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── En-tête ── */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-px bg-gold-primary/60" />
            <span className="text-gold-light text-xs font-semibold uppercase tracking-widest">
              Nos engagements
            </span>
            <div className="w-8 h-px bg-gold-primary/60" />
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-3">
            La preuve par les résultats — pas par les promesses
          </h2>
          <p className="text-text-secondary text-sm max-w-2xl mx-auto">
            Pas de gains mirobolants ni de témoignages invérifiables. À la place :
            des résultats publics, une méthode documentée et des garanties réelles.
          </p>
        </div>

        {/* ── Bandeau garanties réelles ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {GARANTIES.map((g, i) => (
            <div
              key={i}
              className={`card-base p-5 flex flex-col gap-3 transition-all ${
                g.accent
                  ? "border-gold-primary/50 ring-1 ring-gold-primary/20 shadow-gold"
                  : "hover:border-gold-primary/30"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                g.accent ? "bg-gold-faint border-gold-primary/40" : "bg-bg-elevated border-border"
              }`}>
                <g.icon className={`w-5 h-5 ${g.accent ? "text-gold-primary" : "text-text-secondary"}`} />
              </div>
              <h3 className="font-serif font-bold text-text-primary text-sm leading-snug">{g.titre}</h3>
              <p className="text-text-secondary text-xs leading-relaxed">{g.texte}</p>
            </div>
          ))}
        </div>

        {/* ── Méthode en 3 piliers + liens forts ── */}
        <div className="grid lg:grid-cols-3 gap-4 mb-12">
          {METHODE.map((m, i) => (
            <div key={i} className="flex items-start gap-4 p-5 rounded-2xl bg-bg-elevated/50 border border-border/50">
              <div className="w-9 h-9 rounded-full bg-gold-faint border border-gold-primary/30 flex items-center justify-center flex-shrink-0">
                <m.icon className="w-4 h-4 text-gold-primary" />
              </div>
              <div>
                <h3 className="text-text-primary font-semibold text-sm mb-1">{m.titre}</h3>
                <p className="text-text-secondary text-xs leading-relaxed">{m.texte}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
          <Link
            href="/performances"
            className="flex items-center gap-2 px-7 py-3.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold w-full sm:w-auto justify-center"
          >
            <TrendingUp className="w-4 h-4" />
            Vérifier nos résultats
            <ChevronRight className="w-4 h-4" />
          </Link>
          <Link
            href="/methodologie"
            className="flex items-center gap-2 px-7 py-3.5 border border-border hover:border-gold-primary/40 text-text-primary font-semibold text-sm rounded-xl transition-all w-full sm:w-auto justify-center"
          >
            Découvrir la méthode
          </Link>
          <Link
            href="/arnaques-pronostics"
            className="flex items-center gap-2 px-7 py-3.5 border border-border hover:border-gold-primary/40 text-text-primary font-semibold text-sm rounded-xl transition-all w-full sm:w-auto justify-center"
          >
            <ShieldCheck className="w-4 h-4 text-gold-primary" />
            Repérer une arnaque
          </Link>
        </div>

        {/* ── Témoignages RÉELS (uniquement s'il en existe ≥1 approuvé) ── */}
        {temoignages.length > 0 && (
          <div className="mb-14">
            <div className="text-center mb-8">
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-text-primary mb-2">
                Ils témoignent
              </h3>
              {/* Disclaimer obligatoire — résultats individuels, jeu responsable */}
              <p className="text-text-muted text-xs max-w-xl mx-auto">
                Témoignages authentiques d&apos;abonnés, vérifiés avant publication. Les résultats
                sont individuels et ne garantissent pas les vôtres — le jeu comporte des risques.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {temoignages.map((t) => (
                <div key={t.id} className="card-base p-5">
                  <Quote className="w-5 h-5 text-gold-primary/60 mb-3" />
                  <p className="text-text-secondary text-sm leading-relaxed mb-4">{t.texte}</p>
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/50">
                    <div>
                      <p className="text-text-primary text-sm font-semibold">{t.nom_affiche}</p>
                      <p className="text-text-muted text-xs">
                        {[t.ville, t.pays].filter(Boolean).join(", ")}
                        {t.pack ? ` · Pack ${t.pack}` : ""}
                      </p>
                    </div>
                    {t.note != null && (
                      <span className="flex items-center gap-1 text-gold-light text-xs font-semibold flex-shrink-0">
                        <Star className="w-3.5 h-3.5 fill-current" /> {t.note}/5
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CTA témoignage réel (expérience — pas « gain ») ── */}
        <div className="text-center p-6 rounded-2xl bg-bg-card border border-border max-w-2xl mx-auto">
          <MessageCircle className="w-8 h-8 text-gold-primary mx-auto mb-3" />
          <h3 className="font-serif font-semibold text-text-primary text-lg mb-2">
            Vous êtes parmi nos premiers abonnés ?
          </h3>
          <p className="text-text-secondary text-sm mb-4">
            Partagez votre expérience — un mois offert pour les témoignages retenus.
            Seuls des retours authentiques et vérifiés seront publiés.
          </p>
          <a
            href={whatsappUrl("Bonjour Elite Turf, je souhaite partager mon expérience d'abonné.")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold text-sm rounded-xl transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Partager mon expérience
          </a>
        </div>

      </div>
    </section>
  );
}
