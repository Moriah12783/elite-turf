"use client";

import { ChevronDown } from "lucide-react";
import { whatsappUrl } from "@/lib/constants/whatsapp";
import { STARTER_OFFRE_LABEL } from "@/lib/pricing";

const FAQ_ITEMS = [
  {
    q: "À quelle heure les pronostics sont-ils publiés ?",
    a: "Les pronostics du jour (Quinté+, Quarté+, Tiercé) sont publiés chaque matin entre 8h30 et 9h30 (heure GMT, soit l'heure locale d'Abidjan et Dakar). Si vous êtes abonné, vous recevez une alerte par email et WhatsApp dès la publication.",
  },
  {
    q: "Que contient le guide gratuit ?",
    a: "Le guide PDF 'Les 5 secrets pour détecter les outsiders gagnants' vous révèle les méthodes que nos experts utilisent chaque jour : lecture de fiche, exploitation des côtes, identification des outsiders à valeur. 100% gratuit, accessible en un clic.",
  },
  {
    q: "Faut-il créer un compte pour télécharger le guide ?",
    a: "Non. Le guide est accessible directement, sans inscription obligatoire. Cliquez sur 'Télécharger le guide gratuit' et c'est immédiat.",
  },
  {
    q: "Où consulter les performances d'Elite Turf ?",
    a: "Toutes nos performances sont disponibles sur la page /performances. Résultats quotidiens, taux de réussite, historique complet — vérifiables et transparents. Rien n'est caché.",
  },
  {
    q: "Les pronostics sont-ils vraiment fiables ?",
    a: "Nos résultats sont publics et vérifiables. Vous pouvez consulter l'intégralité de notre historique sur la page Performances. Nous publions les bons comme les moins bons résultats, parce que la transparence est notre engagement.",
  },
  {
    q: "Que contient un abonnement Elite Turf ?",
    a: `Selon votre formule : accès aux pronostics quotidiens Quinté+, Quarté+, Tiercé, analyses détaillées (base, outsider, confiance), espace membre personnalisé, et notifications. Le Pack Starter donne accès à ${STARTER_OFFRE_LABEL}, le Pack Pro à l'intégralité, Quinté+ inclus.`,
  },
  {
    q: "Comment payer depuis la Côte d'Ivoire ou l'Afrique ?",
    a: "Choisissez votre plan, sélectionnez Orange Money, MTN MoMo ou Wave. Vous recevez une notification sur votre téléphone. Validez et votre accès est actif en moins de 2 minutes. La conversion FCFA est automatique.",
  },
  {
    q: "Le site est-il accessible sur mobile ?",
    a: "Oui, Elite Turf est conçu mobile-first. L'interface est fluide et rapide sur tous les appareils. Nous savons que la majorité de nos parieurs africains consulte depuis leur téléphone.",
  },
  {
    q: "Puis-je annuler à tout moment ?",
    a: "Oui. Tous nos abonnements sont mensuels, sans engagement de durée. Vous gardez l'accès jusqu'à la fin de la période payée, puis ça s'arrête automatiquement — sans frais, sans démarche.",
  },
  {
    q: "Comment contacter le support ?",
    a: "Par email : contact@elite-turf.fr · Par WhatsApp : +33 6 44 68 67 20 (Lun–Sam, 8h–20h heure de Paris). Notre équipe répond en général en moins de 2h.",
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
          <a href={whatsappUrl()} className="text-gold-primary hover:underline" target="_blank" rel="noopener noreferrer">
            +33 6 44 68 67 20
          </a>
        </p>
      </div>
    </section>
  );
}
