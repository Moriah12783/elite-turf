"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, Save, Loader2, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

/**
 * Pays + indicatif téléphonique (identique à app/(auth)/inscription/page.tsx).
 * À factoriser dans lib/utils/pays.ts dans une session ultérieure.
 */
const PAYS_OPTIONS: Array<{ nom: string; indicatif: string }> = [
  { nom: "Côte d'Ivoire",     indicatif: "+225" },
  { nom: "Sénégal",           indicatif: "+221" },
  { nom: "Cameroun",          indicatif: "+237" },
  { nom: "Burkina Faso",      indicatif: "+226" },
  { nom: "Mali",              indicatif: "+223" },
  { nom: "Bénin",             indicatif: "+229" },
  { nom: "Togo",              indicatif: "+228" },
  { nom: "Guinée",            indicatif: "+224" },
  { nom: "Guinée-Bissau",     indicatif: "+245" },
  { nom: "Niger",             indicatif: "+227" },
  { nom: "Tchad",             indicatif: "+235" },
  { nom: "Congo Brazzaville", indicatif: "+242" },
  { nom: "RD Congo",          indicatif: "+243" },
  { nom: "Gabon",             indicatif: "+241" },
  { nom: "Centrafrique",      indicatif: "+236" },
  { nom: "Madagascar",        indicatif: "+261" },
  { nom: "Maroc",             indicatif: "+212" },
  { nom: "La Réunion",        indicatif: "+262" },
  { nom: "France",            indicatif: "+33"  },
  { nom: "Belgique",          indicatif: "+32"  },
  { nom: "Canada",            indicatif: "+1"   },
  { nom: "Autre",             indicatif: ""     },
];

const INDICATIF_BY_PAYS: Record<string, string> = Object.fromEntries(
  PAYS_OPTIONS.map((p) => [p.nom, p.indicatif]),
);

function estPrefixSeul(phone: string): boolean {
  const trimmed = phone.trim();
  if (!trimmed) return true;
  return /^\+\d{1,4}\s*$/.test(trimmed);
}

interface Props {
  userId:            string;
  email:             string;
  nomCompletInitial: string;
  paysInitial:       string;
}

export default function CompleterProfilForm({
  userId, email, nomCompletInitial, paysInitial,
}: Props) {
  const router = useRouter();

  // Pré-remplir avec l'indicatif du pays initial
  const indicatifInitial = INDICATIF_BY_PAYS[paysInitial] || "+225";
  const [pays,  setPays]  = useState(paysInitial);
  const [phone, setPhone] = useState(`${indicatifInitial} `);
  const [nomComplet, setNomComplet] = useState(nomCompletInitial);
  const [loading, setLoading] = useState(false);

  const handlePaysChange = (newPays: string) => {
    setPays(newPays);
    const newIndicatif = INDICATIF_BY_PAYS[newPays] || "";
    if (estPrefixSeul(phone) && newIndicatif) {
      setPhone(`${newIndicatif} `);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const phoneTrimmed = phone.trim();
    if (!phoneTrimmed || estPrefixSeul(phoneTrimmed)) {
      toast.error("Le numéro de téléphone est requis");
      return;
    }
    const digits = phoneTrimmed.replace(/\D/g, "");
    if (digits.length < 8) {
      toast.error("Numéro de téléphone trop court (8 chiffres minimum)");
      return;
    }
    if (!nomComplet.trim()) {
      toast.error("Le nom complet est requis");
      return;
    }

    setLoading(true);
    try {
      // Appel à l'API serveur (qui utilise service_role pour bypass RLS récursive)
      const res = await fetch("/api/profile/complete", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          phone:      phoneTrimmed,
          pays,
          nomComplet: nomComplet.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        toast.error(`Erreur : ${data.reason || data.error || "inconnue"}`);
        return;
      }

      toast.success("Profil complété avec succès ! 🎉");
      // Petite pause pour que le toast soit visible
      setTimeout(() => router.push("/espace-membre"), 800);
    } catch (err) {
      toast.error("Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-base p-6 sm:p-8">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gold-faint border border-gold-primary/30 mb-4">
          <Phone className="w-7 h-7 text-gold-primary" />
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-2">
          Une dernière étape
        </h1>
        <p className="text-text-secondary text-sm leading-relaxed">
          Pour finaliser votre compte et débloquer le support WhatsApp + vos futurs
          paiements Mobile Money, complétez votre profil ci-dessous.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email (read-only, juste pour info) */}
        <div>
          <label className="block text-text-secondary text-sm font-medium mb-2">
            Adresse email
          </label>
          <input
            type="email"
            value={email}
            readOnly
            className="w-full px-4 py-3 bg-bg-elevated/50 border border-border rounded-xl text-text-muted text-sm cursor-not-allowed"
          />
        </div>

        {/* Nom complet */}
        <div>
          <label className="block text-text-secondary text-sm font-medium mb-2">
            Nom complet <span className="text-status-loss">*</span>
          </label>
          <input
            type="text"
            value={nomComplet}
            onChange={(e) => setNomComplet(e.target.value)}
            placeholder="Kouassi Jean-Baptiste"
            required
            className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder-text-muted text-sm"
          />
        </div>

        {/* Pays */}
        <div>
          <label className="block text-text-secondary text-sm font-medium mb-2">
            Pays <span className="text-status-loss">*</span>
          </label>
          <select
            value={pays}
            onChange={(e) => handlePaysChange(e.target.value)}
            className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary text-sm appearance-none"
            required
          >
            {PAYS_OPTIONS.map((p) => (
              <option key={p.nom} value={p.nom}>
                {p.nom}{p.indicatif ? ` (${p.indicatif})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Téléphone */}
        <div>
          <label className="block text-text-secondary text-sm font-medium mb-2">
            Téléphone (Mobile Money / WhatsApp) <span className="text-status-loss">*</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={
              (INDICATIF_BY_PAYS[pays] || "+225") + " 07 89 45 67 89"
            }
            required
            className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder-text-muted text-sm"
          />
          <p className="mt-1.5 text-text-muted text-xs leading-relaxed flex items-start gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-status-win flex-shrink-0 mt-0.5" />
            Utilisé pour notre support WhatsApp et vos futurs paiements Mobile Money.
            Jamais partagé avec des tiers.
          </p>
        </div>

        {/* Action */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-gold-primary hover:bg-gold-dark disabled:opacity-60 disabled:cursor-not-allowed text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold-sm mt-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {loading ? "Enregistrement…" : "Valider mon profil"}
        </button>
      </form>

      <p className="text-center text-text-muted text-xs mt-6 leading-relaxed">
        🔒 Ces informations restent confidentielles et ne sont jamais partagées avec des tiers.
      </p>
    </div>
  );
}
