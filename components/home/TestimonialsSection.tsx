import { Star, Quote, TrendingUp, Award, MessageCircle } from "lucide-react";

const testimonials = [
  {
    nom: "Kouassi A.",
    ville: "Abidjan",
    pays: "🇨🇮",
    plan: "Plan Pro",
    planColor: "text-gold-primary bg-gold-faint border-gold-primary/30",
    texte:
      "Le Quinté+ de Vincennes la semaine dernière m'a rapporté +320€ nets. L'analyse est vraiment sérieuse, ils expliquent pourquoi chaque cheval est sélectionné. Je renouvelle chaque mois.",
    stars: 5,
    initiale: "K",
    gain: "+320 €",
    gainColor: "text-status-win",
    pari: "Quinté+ Vincennes",
    date: "Mars 2026",
    avatarBg: "bg-gradient-to-br from-gold-primary to-gold-light",
  },
  {
    nom: "Mamadou D.",
    ville: "Dakar",
    pays: "🇸🇳",
    plan: "Plan Elite",
    planColor: "text-purple-400 bg-purple-500/10 border-purple-500/30",
    texte:
      "Abonné Elite depuis 4 mois. Le pronostic VIP du Prix de France m'a rapporté +850€. Depuis le Sénégal, on joue sur les mêmes courses PMU via notre loterie nationale.",
    stars: 5,
    initiale: "M",
    gain: "+850 €",
    gainColor: "text-status-win",
    pari: "Quarté+ Longchamp",
    date: "Fév. 2026",
    avatarBg: "bg-gradient-to-br from-purple-600 to-purple-400",
  },
  {
    nom: "Jean-Baptiste O.",
    ville: "Paris",
    pays: "🇫🇷",
    plan: "Plan Pro",
    planColor: "text-gold-primary bg-gold-faint border-gold-primary/30",
    texte:
      "Meilleur taux de réussite que tous les pronostiqueurs testés. Le support WhatsApp parisien répond en 20 min. Parfait pour suivre Vincennes et Longchamp au quotidien.",
    stars: 5,
    initiale: "J",
    gain: "+195 €",
    gainColor: "text-status-win",
    pari: "Tiercé Chantilly",
    date: "Mars 2026",
    avatarBg: "bg-gradient-to-br from-blue-600 to-blue-400",
  },
  {
    nom: "Fatou K.",
    ville: "Abidjan",
    pays: "🇨🇮",
    plan: "Plan Starter",
    planColor: "text-text-secondary bg-bg-elevated border-border",
    texte:
      "Commencé avec le Starter à 9,90€. Dès la 2ème semaine, j'ai gagné +120€ sur un Tiercé Vincennes via le PMU-CI. Le plan se rembourse très vite !",
    stars: 5,
    initiale: "F",
    gain: "+120 €",
    gainColor: "text-status-win",
    pari: "Tiercé Vincennes",
    date: "Janv. 2026",
    avatarBg: "bg-gradient-to-br from-pink-500 to-pink-300",
  },
  {
    nom: "Ibrahim T.",
    ville: "Casablanca",
    pays: "🇲🇦",
    plan: "Plan Elite",
    planColor: "text-purple-400 bg-purple-500/10 border-purple-500/30",
    texte:
      "Je joue via le PMU Maroc sur les courses françaises. Le Quinté+ VIP d'il y a 2 semaines m'a rapporté +1 200€. Je recommande à tous mes amis turfistes marocains.",
    stars: 5,
    initiale: "I",
    gain: "+1 200 €",
    gainColor: "text-status-win",
    pari: "Quinté+ Vincennes",
    date: "Mars 2026",
    avatarBg: "bg-gradient-to-br from-green-600 to-green-400",
  },
  {
    nom: "Brice N.",
    ville: "Abidjan",
    pays: "🇨🇮",
    plan: "Plan Pro",
    planColor: "text-gold-primary bg-gold-faint border-gold-primary/30",
    texte:
      "La carte VEDETTE DU JOUR est ma préférée. 3 Tiercés gagnants consécutifs en janvier sur Longchamp et Saint-Cloud. Le ROI est impressionnant pour 19,90€/mois.",
    stars: 4,
    initiale: "B",
    gain: "+540 €",
    gainColor: "text-status-win",
    pari: "Série Tiercé PMU",
    date: "Janv.–Fév. 2026",
    avatarBg: "bg-gradient-to-br from-orange-500 to-amber-400",
  },
];

const GLOBAL_STATS = [
  { label: "Gains cumulés abonnés", value: "48 000€+", Icon: TrendingUp },
  { label: "Note moyenne",          value: "4.8 / 5",  Icon: Star       },
  { label: "Abonnés satisfaits",    value: "847+",      Icon: Award      },
];

export default function TestimonialsSection() {
  return (
    <section className="relative py-16 sm:py-20 overflow-hidden">

      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1516673699707-4f2a243fafaf?w=1600&q=80"
          alt="Hippodrome PMU France"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-bg-primary/92" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary/50 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary/50 to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* En-tête */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-black/40 border border-gold-primary/30 rounded-full mb-4">
            <Quote className="w-4 h-4 text-gold-primary" />
            <span className="text-gold-light text-xs font-semibold uppercase tracking-wider">
              Ils ont gagné avec Elite Turf
            </span>
          </div>
          <h2 className="font-serif text-2xl sm:text-4xl font-bold text-text-primary mb-3">
            Des Gains Réels,{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #C9A84C, #E8D5A3, #A07830)" }}
            >
              Des Abonnés Heureux
            </span>
          </h2>
          <p className="text-text-secondary text-base max-w-xl mx-auto">
            Des parieurs d&apos;parieurs francophones et de la diaspora nous font confiance pour les courses PMU françaises.
          </p>
        </div>

        {/* Stats globales */}
        <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-12">
          {GLOBAL_STATS.map(({ label, value, Icon }) => (
            <div key={label} className="card-base p-4 text-center">
              <Icon className="w-5 h-5 text-gold-primary mx-auto mb-2" fill={label === "Note moyenne" ? "#C9A84C" : "none"} />
              <p className="font-serif font-bold text-xl text-text-primary">{value}</p>
              <p className="text-text-muted text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Grille témoignages */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
          {testimonials.map((t, i) => (
            <div key={i} className="card-base p-5 flex flex-col backdrop-blur-sm hover:border-gold-primary/30 transition-colors">
              {/* Gain */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className={`text-xl font-bold font-serif ${t.gainColor}`}>{t.gain}</p>
                  <p className="text-text-muted text-xs">{t.pari} · {t.date}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-status-win/30" />
              </div>

              {/* Stars */}
              <div className="flex items-center gap-0.5 mb-3">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className="w-3.5 h-3.5"
                    fill={j < t.stars ? "#C9A84C" : "transparent"}
                    color={j < t.stars ? "#C9A84C" : "#3A3A50"}
                  />
                ))}
              </div>

              <p className="text-text-secondary text-sm leading-relaxed flex-1 mb-4 italic">
                &ldquo;{t.texte}&rdquo;
              </p>

              <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-serif font-bold text-white text-base flex-shrink-0 ${t.avatarBg}`}>
                  {t.initiale}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary text-sm font-semibold">{t.nom} <span className="font-normal">{t.pays}</span></p>
                  <p className="text-text-muted text-xs truncate">{t.ville}</p>
                </div>
                <span className={`flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full border ${t.planColor}`}>
                  {t.plan}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* CTA post-gain */}
        <div className="max-w-2xl mx-auto text-center p-6 rounded-2xl bg-bg-card border border-gold-primary/20">
          <Award className="w-8 h-8 text-gold-primary mx-auto mb-3" />
          <h3 className="font-serif font-bold text-text-primary text-lg mb-2">
            Vous avez gagné grâce à Elite Turf ?
          </h3>
          <p className="text-text-secondary text-sm mb-4">
            Partagez votre gain et inspirez la communauté. Les meilleurs témoignages
            reçoivent un mois d&apos;abonnement offert.
          </p>
          <a
            href={`https://wa.me/${(process.env.NEXT_PUBLIC_WHATSAPP || "+33644686720").replace(/\s/g, "")}?text=Bonjour, je voudrais partager mon gain avec Elite Turf !`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold text-sm rounded-xl transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Partager mon gain sur WhatsApp
          </a>
        </div>

      </div>
    </section>
  );
}
