"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, UserPlus, Loader2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { trackEvent } from "@/lib/analytics/track";

// Source unique : lib/utils/pays.ts. Contient PAYS_OPTIONS (22 pays +
// indicatifs E.164), INDICATIF_BY_PAYS (map dérivée), et estPrefixSeul().
import { PAYS_OPTIONS, INDICATIF_BY_PAYS, estPrefixSeul } from "@/lib/utils/pays";

function InscriptionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planSelectionne = searchParams.get("plan") || "";

  const [form, setForm] = useState({
    nomComplet: "",
    email: "",
    // Pré-rempli avec l'indicatif Côte d'Ivoire (+225 ) par défaut puisque
    // c'est le pays par défaut sélectionné.
    phone: "+225 ",
    pays: "Côte d'Ivoire",
    password: "",
    confirmPassword: "",
  });
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [cguAccepted, setCguAccepted] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "success">("form");

  const updateForm = (field: string, value: string) => {
    setForm((prev) => {
      // Cas spécial : quand on change de pays, auto-update le préfixe
      // téléphone si l'utilisateur n'a pas encore tapé ses chiffres
      // (sinon on ne touche pas pour ne pas écraser sa saisie).
      if (field === "pays") {
        const nouvelIndicatif = INDICATIF_BY_PAYS[value] || "";
        const nouveauPhone =
          estPrefixSeul(prev.phone) && nouvelIndicatif
            ? `${nouvelIndicatif} `
            : prev.phone;
        return { ...prev, pays: value, phone: nouveauPhone };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ── Validation téléphone obligatoire (souple) ─────────────────────
    const phoneTrimmed = form.phone.trim();
    if (!phoneTrimmed || estPrefixSeul(phoneTrimmed)) {
      toast.error("Le numéro de téléphone est requis");
      return;
    }
    // Vérification minimale : au moins 8 chiffres au total (pour éviter
    // les saisies dégénérées type "+225" tout court)
    const digits = phoneTrimmed.replace(/\D/g, "");
    if (digits.length < 8) {
      toast.error("Numéro de téléphone trop court (8 chiffres minimum)");
      return;
    }

    if (!ageConfirmed) {
      toast.error("Vous devez confirmer avoir 18 ans ou plus");
      return;
    }
    if (!cguAccepted) {
      toast.error("Vous devez accepter les CGU et la Politique de confidentialité");
      return;
    }

    if (form.password !== form.confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            nom_complet: form.nomComplet,
            phone: form.phone,
            pays: form.pays,
            plan_souhaite: planSelectionne,
            whatsapp_opt_in: whatsappOptIn,
            whatsapp_opt_in_date: whatsappOptIn ? new Date().toISOString() : null,
            whatsapp_opt_in_text: whatsappOptIn
              ? "J'accepte de recevoir des messages WhatsApp de la part de TSALACH VENTURES LLC (Elite Turf) concernant mes pronostics et mon abonnement."
              : null,
          },
        },
      });

      if (error) {
        console.error("Supabase signUp error:", error.message, error);
        if (
          error.message.includes("already registered") ||
          error.message.includes("already been registered") ||
          error.message.includes("User already registered")
        ) {
          toast.error("Cet email est déjà utilisé. Connectez-vous.");
        } else if (error.message.includes("rate limit") || error.message.includes("email rate")) {
          toast.error("Trop de tentatives. Attendez quelques minutes et réessayez.");
        } else if (error.message.includes("invalid") && error.message.includes("email")) {
          toast.error("Adresse email invalide.");
        } else if (error.message.includes("Password") || error.message.includes("password")) {
          toast.error("Mot de passe trop faible. Utilisez au moins 8 caractères.");
        } else if (error.message.includes("Database error") || error.message.includes("database")) {
          toast.error("Erreur base de données. Contactez le support.");
        } else {
          toast.error(`Erreur : ${error.message}`);
        }
        return;
      }

      // Envoyer l'email de bienvenue (non-bloquant)
      fetch("/api/welcome-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          nomComplet: form.nomComplet,
          pays: form.pays,
        }),
      }).catch(() => {}); // Silencieux si échec

      // ── GA4 funnel event : sign_up ──
      // Tracké dès que Supabase signUp réussit. Pas d'email/nom dans l'event
      // (PII forbidden GA4). On track le pays (signal géo utile) et le plan
      // initialement choisi (signal d'intent commercial).
      trackEvent("sign_up", {
        method:        "email_password",
        country:       form.pays,
        plan_id:       planSelectionne || undefined,
        whatsapp_opt:  whatsappOptIn,
      });

      setStep("success");
    } catch {
      toast.error("Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  if (step === "success") {
    return (
      <div className="card-base p-6 sm:p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-status-win/10 border border-status-win/30 flex items-center justify-center mx-auto mb-6">
          <Check className="w-8 h-8 text-status-win" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-text-primary mb-3">
          Compte créé !
        </h2>
        <p className="text-text-secondary text-sm mb-2">
          Votre compte a été créé avec succès pour{" "}
          <strong className="text-text-primary">{form.email}</strong>.
        </p>
        <p className="text-text-secondary text-sm mb-8">
          Vous pouvez maintenant vous connecter et accéder aux pronostics du jour.
        </p>
        {planSelectionne && (
          <div className="mb-6 p-4 bg-gold-faint border border-gold-primary/20 rounded-xl">
            <p className="text-gold-light text-sm">
              Après confirmation, vous serez redirigé vers le paiement du plan{" "}
              <strong className="capitalize">{planSelectionne}</strong>.
            </p>
          </div>
        )}
        <Link
          href="/connexion"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <div className="card-base p-6 sm:p-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-2">
          Créer un compte
        </h1>
        <p className="text-text-secondary text-sm">
          Gratuit · Accès immédiat aux pronostics du jour
        </p>
        {planSelectionne && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-gold-faint border border-gold-primary/30 rounded-full">
            <span className="text-gold-light text-xs font-medium">
              Plan {planSelectionne} sélectionné
            </span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nom complet */}
        <div>
          <label className="block text-text-secondary text-sm font-medium mb-2">
            Nom complet
          </label>
          <input
            type="text"
            value={form.nomComplet}
            onChange={(e) => updateForm("nomComplet", e.target.value)}
            placeholder="Kouassi Jean-Baptiste"
            required
            className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder-text-muted text-sm"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-text-secondary text-sm font-medium mb-2">
            Adresse email
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => updateForm("email", e.target.value)}
            placeholder="votre@email.com"
            required
            className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder-text-muted text-sm"
          />
        </div>

        {/* Pays + Téléphone (l'ordre matters : pays d'abord pour que
            l'auto-prefix téléphone fonctionne quand on change de pays) */}
        <div>
          <label className="block text-text-secondary text-sm font-medium mb-2">
            Pays <span className="text-status-loss">*</span>
          </label>
          <select
            value={form.pays}
            onChange={(e) => updateForm("pays", e.target.value)}
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

        <div>
          <label className="block text-text-secondary text-sm font-medium mb-2">
            Téléphone (Mobile Money / WhatsApp) <span className="text-status-loss">*</span>
          </label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => updateForm("phone", e.target.value)}
            placeholder={
              (INDICATIF_BY_PAYS[form.pays] || "+225") + " 07 89 45 67 89"
            }
            required
            className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder-text-muted text-sm"
          />
          <p className="mt-1.5 text-text-muted text-xs leading-relaxed">
            🔒 Utilisé uniquement pour vos paiements Mobile Money et notre support WhatsApp.
            Jamais partagé avec des tiers.
          </p>
        </div>

        {/* Password */}
        <div>
          <label className="block text-text-secondary text-sm font-medium mb-2">
            Mot de passe
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(e) => updateForm("password", e.target.value)}
              placeholder="Minimum 8 caractères"
              required
              minLength={8}
              className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder-text-muted text-sm pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Confirm password */}
        <div>
          <label className="block text-text-secondary text-sm font-medium mb-2">
            Confirmer le mot de passe
          </label>
          <input
            type="password"
            value={form.confirmPassword}
            onChange={(e) => updateForm("confirmPassword", e.target.value)}
            placeholder="Répétez le mot de passe"
            required
            className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder-text-muted text-sm"
          />
        </div>

        {/* ── Consentements légaux ── */}
        <div className="space-y-3 pt-1">
          {/* Case 1 — Âge (obligatoire) */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={ageConfirmed}
              onChange={(e) => setAgeConfirmed(e.target.checked)}
              className="mt-0.5 accent-[#C9A84C] flex-shrink-0"
            />
            <span className="text-text-muted text-xs leading-relaxed">
              <span className="text-status-loss font-medium">*</span>{" "}
              Je confirme avoir <strong className="text-text-secondary">18 ans ou plus</strong>.
              L&apos;accès au site est réservé aux majeurs.
            </span>
          </label>

          {/* Case 2 — CGU (obligatoire) */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={cguAccepted}
              onChange={(e) => setCguAccepted(e.target.checked)}
              className="mt-0.5 accent-[#C9A84C] flex-shrink-0"
            />
            <span className="text-text-muted text-xs leading-relaxed">
              <span className="text-status-loss font-medium">*</span>{" "}
              J&apos;accepte les{" "}
              <Link href="/cgu" target="_blank" className="text-gold-primary hover:underline">
                Conditions Générales d&apos;Utilisation
              </Link>{" "}
              et la{" "}
              <Link href="/confidentialite" target="_blank" className="text-gold-primary hover:underline">
                Politique de confidentialité
              </Link>{" "}
              de TSALACH VENTURES LLC (Elite Turf).
            </span>
          </label>

          {/* Case 3 — WhatsApp opt-in (facultative) */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={whatsappOptIn}
              onChange={(e) => setWhatsappOptIn(e.target.checked)}
              className="mt-0.5 accent-[#C9A84C] flex-shrink-0"
            />
            <span className="text-text-muted text-xs leading-relaxed">
              <span className="text-text-muted/60 italic">(Facultatif)</span>{" "}
              J&apos;accepte de recevoir des messages WhatsApp de la part de{" "}
              <strong className="text-text-secondary">TSALACH VENTURES LLC (Elite Turf)</strong>{" "}
              concernant mes pronostics et mon abonnement. Désabonnement possible à tout moment
              en répondant STOP.
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-gold-primary hover:bg-gold-dark disabled:opacity-60 disabled:cursor-not-allowed text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold-sm mt-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
          {loading ? "Création en cours…" : "Créer mon compte"}
        </button>
      </form>

      <p className="text-center text-text-secondary text-sm mt-6">
        Déjà un compte ?{" "}
        <Link href="/connexion" className="text-gold-primary hover:text-gold-light font-semibold transition-colors">
          Se connecter
        </Link>
      </p>
    </div>
  );
}

export default function InscriptionPage() {
  return (
    <Suspense fallback={<div className="card-base p-8 text-center text-text-muted">Chargement…</div>}>
      <InscriptionForm />
    </Suspense>
  );
}
