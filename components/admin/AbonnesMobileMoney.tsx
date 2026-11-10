"use client";

/**
 * Abonnés Orange Money / Wave dans /admin/utilisateurs : activation d'un
 * paiement, et inscription d'un abonné sans e-mail (10/11/2026). Le compte créé
 * sans e-mail est passé au formulaire d'activation par l'état de ce composant,
 * jamais par l'adresse de la page (GA4 enregistre les URL visitées).
 */
import { useState } from "react";
import ActiverMobileMoney, { type Prerempli } from "@/components/admin/ActiverMobileMoney";
import InscrireSansEmail from "@/components/admin/InscrireSansEmail";

export default function AbonnesMobileMoney() {
  const [prerempli, setPrerempli] = useState<Prerempli | null>(null);

  return (
    <>
      <ActiverMobileMoney prerempli={prerempli} />
      <InscrireSansEmail onActiver={(email) => setPrerempli({ email, jeton: Date.now() })} />
    </>
  );
}
