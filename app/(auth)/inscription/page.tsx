"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, UserPlus, Loader2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

const PAYS_OPTIONS = [
  "Côte d'Ivoire",
  "Sénégal",
  "Cameroun",
  "Burkina Faso",
  "Mali",
  "Guinée",
  "Togo",
  "Bénin",
  "Congo",
  "France (diaspora)",
  "Belgique (diaspora)",
  "Autre",
];

function InscriptionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planSelectionne = searchParams.get("plan") || "";

  const [form, setForm] = useState({
    nomComplet: "",
    email: "",
    phone: "",
    pays: "Côte d'Ivoire",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "success">("form");

  const updateForm = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
          },
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("Cet email est déjà utilisé. Connectez-vous.");
        } else {
          toast.error("Erreur lors de l'inscription. Réessayez.");
        }
        return;
      }

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
          Un email de confirmation a été envoyé à{" "}
          <strong className="text-text-primary">{form.email}</strong>.
        </p>
        <p className="text-text-secondary text-sm mb-8">
          Cliquez sur le lien dans l&apos;email pour activer votre compte.
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

        {/* Phone + Pays on same row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-text-secondary text-sm font-medium mb-2">
              Téléphone (optionnel)
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => updateForm("phone", e.target.value)}
              placeholder="+225 07..."
              className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder-text-muted text-sm"
            />
          </div>
          <div>
            <label className="block text-text-secondary text-sm font-medium mb-2">
              Pays
            </label>
            <select
              value={form.pays}
              onChange={(e) => updateForm("pays", e.target.value)}
              className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary text-sm appearance-none"
            >
              {PAYS_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
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

        {/* CGU */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" required className="mt-0.5 accent-[#C9A84C]" />
          <span className="text-text-muted text-xs leading-relaxed">
            J&apos;accepte les{" "}
            <Link href="/cgu" className="text-gold-primary hover:underline">
              Conditions d&apos;utilisation
            </Link>{" "}
            et la{" "}
            <Link href="/confidentialite" className="text-gold-primary hover:underline">
              Politique de confidentialité
            </Link>
          </span>
        </label>

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
