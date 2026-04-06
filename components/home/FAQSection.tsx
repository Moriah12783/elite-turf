"use client";

import { ChevronDown } from "lucide-react";

const FAQ_ITEMS = [
  {
    q: "Les pronostics sont-ils vraiment fiables ?",
    a: "Nos résultats sont publics et vérifiables sur Geny Courses. En 30 derniers jours : 74% de taux de réussite, 18 Quinté+ gagnants. Vous pouvez vérifier chaque pronostic en cliquant sur le lien Geny à côté de chaque résultat.",
  },
  {
    q: "Puis-je accéder à un pronostic gratuit avant de m'abonner ?",
    a: "Oui. Un pronostic Tiercé est publié gratuitement chaque semaine, accessible sans inscription. Téléchargez aussi notre guide PDF '5 secrets pour détecter les outsiders gagnants' — 100% gratuit.",
  },
  {
    q: "Quand sont publiés les pronostics ?",
    a: "Le Quinté+ est publié chaque matin avant 8h heure de Paris. Le Quarté+ avant 9h. Vous êtes notifié par email dès la publication si vous êtes abonné.",
  },
  {
    q: "Comment payer depuis la Côte d'Ivoire ou l'Afrique ?",
    a: "Cliquez sur votre plan, choisissez Orange Money, MTN MoMo ou Wave. Vous recevez une notification push sur votre téléphone. Validez et votre accès est activé en moins de 2 minutes. La conversion FCFA est automatique.",
  },
  {
    q: "Les courses couvertes sont-elles jouables depuis mon pays ?",
    a: "Oui. Toutes nos analyses portent sur les courses françaises (Vincennes, Longchamp, Chantilly) qui sont jouables via PMU-CI, LONASE, PMU Maroc et tous les opérateurs africains agréés.",
  },
  {
    q: "Puis-je annuler à tout moment ?",
    a: "Oui. L'abonnement est mensuel sans engagement. Vous gardez l'accès jusqu'à la fin de la période payée, puis il s'arrête automatiquement.",
  },
  {
    q: "Quel plan choisir si je suis débutant ?",
    a: "Commencez par le Pack Découverte (65€). En 30 jours, vous découvrez la méthode Elite Turf avec 3 pronostics Tiercé/Quarté par semaine — idéal pour comprendre l'approche avant de s'engager davantage.",
  },
];

export default function FAQSection() {
  return (
    <section id="faq" className="py-16 px-4 scroll-mt-20">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-gold-primary text-xs font-bold uppercase tracking-widest mb-2">
            Questions fréquentes
          </p>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary">
            Tout ce que vous devez savoir
          </h2>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <details key={i} className="card-base group">
              <summary className="p-4 cursor-pointer flex items-start justify-between gap-3 list-none select-none">
                <span className="text-text-primary text-sm font-semibold leading-snug">
                  {item.q}
                </span>
                <ChevronDown className="w-4 h-4 text-gold-primary flex-shrink-0 mt-0.5 group-open:rotate-180 transition-transform duration-200" />
              </summary>
              <div className="px-4 pb-4">
                <p className="text-text-secondary text-sm leading-relaxed border-t border-border/50 pt-3">
                  {item.a}
                </p>
              </div>
            </details>
          ))}
        </div>

        <p className="text-center text-text-muted text-xs mt-8">
          Une autre question ?{" "}
          <a href="mailto:contact@elite-turf.fr" className="text-gold-primary hover:underline">
            contact@elite-turf.fr
          </a>{" "}
          · WhatsApp{" "}
          <a href="https://wa.me/33644686720" className="text-gold-primary hover:underline" target="_blank" rel="noopener noreferrer">
            +33 6 44 68 67 20
          </a>
        </p>
      </div>
    </section>
  );
}
