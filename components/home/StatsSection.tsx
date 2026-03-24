import { TrendingUp, Award, Flame, CheckCircle2 } from "lucide-react";

const recentResults = [
  { date: "22 Mars", course: "Quinté+ Longchamp",      type: "Quinté+", result: "GAGNANT", gain: "+380%" },
  { date: "21 Mars", course: "Tiercé Vincennes",       type: "Tiercé",  result: "GAGNANT", gain: "+127%" },
  { date: "20 Mars", course: "Quarté+ Chantilly",      type: "Quarté+", result: "PARTIEL", gain: "+45%"  },
  { date: "19 Mars", course: "Simple Gagnant Paris",   type: "Simple",  result: "GAGNANT", gain: "+210%" },
  { date: "18 Mars", course: "Tiercé Auteuil",         type: "Tiercé",  result: "GAGNANT", gain: "+89%"  },
];

export default function StatsSection() {
  return (
    <section className="relative py-16 sm:py-20 overflow-hidden">

      {/* ── Fond hippodrome avec overlay ── */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1609510038916-9328a3c86966?w=1600&q=80"
          alt="Hippodrome arrière-plan"
          className="w-full h-full object-cover object-center"
        />
        {/* Overlay très sombre pour garder la lisibilité */}
        <div className="absolute inset-0 bg-bg-primary/88" />
        {/* Dégradé latéral or */}
        <div className="absolute inset-0 bg-gradient-to-r from-bg-primary/60 via-transparent to-bg-primary/60" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-gold-primary" />
            <span className="text-gold-light text-sm font-medium uppercase tracking-wider">
              Transparence totale
            </span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary">
            Nos Résultats Prouvés
          </h2>
          <p className="text-text-secondary mt-3 max-w-xl mx-auto text-sm">
            Chez Elite Turf, nous publions tous nos résultats — les victoires comme les défaites.
            La confiance se mérite avec des chiffres réels.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Award,        value: "73%",   label: "Taux de réussite",     sublabel: "Mars 2026",             color: "text-status-win",   bgColor: "bg-status-win/10",   borderColor: "border-status-win/20" },
              { icon: Flame,        value: "8",     label: "Gagnants consécutifs", sublabel: "Série actuelle",        color: "text-gold-primary", bgColor: "bg-gold-faint",      borderColor: "border-gold-primary/20" },
              { icon: TrendingUp,   value: "+127%", label: "ROI moyen",            sublabel: "sur 30 pronostics",     color: "text-status-win",   bgColor: "bg-status-win/10",   borderColor: "border-status-win/20" },
              { icon: CheckCircle2, value: "312",   label: "Pronostics publiés",   sublabel: "depuis le lancement",   color: "text-blue-400",     bgColor: "bg-blue-400/10",     borderColor: "border-blue-400/20" },
            ].map((stat, i) => (
              <div key={i} className={`card-base p-5 border ${stat.borderColor} backdrop-blur-sm`}>
                <div className={`w-10 h-10 rounded-xl ${stat.bgColor} border ${stat.borderColor} flex items-center justify-center mb-3`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div className={`text-3xl font-bold font-serif ${stat.color} mb-1`}>{stat.value}</div>
                <div className="text-text-primary text-sm font-medium">{stat.label}</div>
                <div className="text-text-muted text-xs mt-0.5">{stat.sublabel}</div>
              </div>
            ))}
          </div>

          {/* Recent Results */}
          <div className="card-base p-5 backdrop-blur-sm">
            <h3 className="font-serif font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Flame className="w-4 h-4 text-gold-primary" />
              Derniers Résultats
            </h3>
            <div className="space-y-3">
              {recentResults.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary text-sm font-medium truncate">{r.course}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-text-muted text-xs">{r.date}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-bg-elevated border border-border text-text-secondary">{r.type}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end ml-3">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      r.result === "GAGNANT" ? "bg-status-win/15 text-status-win"
                      : r.result === "PARTIEL" ? "bg-status-partial/15 text-status-partial"
                      : "bg-status-loss/15 text-status-loss"
                    }`}>{r.result}</span>
                    <span className="text-status-win text-xs font-semibold mt-1">{r.gain}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
