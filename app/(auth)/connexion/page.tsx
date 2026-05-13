"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LogIn, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

/**
 * Whitelist des chemins de redirection autorisés après login.
 * Évite l'open-redirect via ?redirect=https://attaquant.com
 *
 * On accepte uniquement les chemins internes commençant par "/" et
 * ne contenant pas "//" ni "@" (qui peuvent embarquer un host externe).
 */
function sanitizeRedirect(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.includes("@")) return "/";
  return raw;
}

/**
 * Mappe le message d'erreur Supabase brut vers un message UI clair.
 * Cf https://supabase.com/docs/guides/auth/auth-helpers/auth-error-codes
 *
 * Avant ce fix, toute erreur ≠ "Invalid login credentials" affichait
 * un générique "Erreur de connexion. Réessayez." qui a masqué pendant
 * 1h le bug de la clé anon désactivée → on log désormais la cause
 * exacte dans la console + on affiche un message plus informatif.
 */
function mapAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid_credentials")) {
    return "Email ou mot de passe incorrect.";
  }
  if (m.includes("email not confirmed")) {
    return "Email non confirmé — vérifie ta boîte mail.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Trop de tentatives. Réessaie dans quelques minutes.";
  }
  if (m.includes("invalid api key") || m.includes("api key")) {
    return "Erreur de configuration serveur. Contacte l'admin.";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "Erreur réseau. Vérifie ta connexion internet.";
  }
  // Message tel-quel pour les cas non couverts → l'admin verra l'erreur
  // exacte plutôt qu'un générique opaque.
  return `Erreur de connexion : ${msg}`;
}

/**
 * Wrapper Suspense obligatoire en Next.js 14 dès qu'on utilise
 * `useSearchParams()` dans un client component, sinon le rendu statique
 * est entièrement déopté (warning au build, et SSG cassé).
 */
export default function ConnexionPage() {
  return (
    <Suspense fallback={<ConnexionSkeleton />}>
      <ConnexionForm />
    </Suspense>
  );
}

function ConnexionSkeleton() {
  return (
    <div className="card-base p-6 sm:p-8 text-center">
      <Loader2 className="w-6 h-6 animate-spin mx-auto text-gold-primary" />
      <p className="text-text-secondary text-sm mt-3">Chargement…</p>
    </div>
  );
}

function ConnexionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = sanitizeRedirect(searchParams.get("redirect"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        // Log défensif : facilite le debug si une nouvelle erreur Supabase
        // arrive (changement d'API, dépréciation de clé, etc.)
        // eslint-disable-next-line no-console
        console.error("[connexion] Supabase signIn error:", error);
        toast.error(mapAuthError(error.message ?? "Erreur inconnue"));
        return;
      }

      toast.success("Connexion réussie !");
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[connexion] Unexpected error:", err);
      const msg = err instanceof Error ? err.message : "Une erreur est survenue";
      toast.error(`Erreur inattendue : ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-base p-6 sm:p-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-2">
          Bon retour
        </h1>
        <p className="text-text-secondary text-sm">
          Connectez-vous pour accéder à vos pronostics
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-text-secondary text-sm font-medium mb-2">
            Adresse email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="votre@email.com"
            required
            className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder-text-muted text-sm transition-colors"
          />
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-text-secondary text-sm font-medium mb-2">
            Mot de passe
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder-text-muted text-sm pr-12 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <div className="mt-2 text-right">
            <Link href="/mot-de-passe-oublie" className="text-gold-primary hover:text-gold-light text-xs transition-colors">
              Mot de passe oublié ?
            </Link>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gold-primary hover:bg-gold-dark disabled:opacity-60 disabled:cursor-not-allowed text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold-sm"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <LogIn className="w-5 h-5" />
          )}
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>

      {/* Divider */}
      <div className="my-6 flex items-center gap-3">
        <hr className="flex-1 border-border" />
        <span className="text-text-muted text-xs">ou</span>
        <hr className="flex-1 border-border" />
      </div>

      {/* Sign up link */}
      <p className="text-center text-text-secondary text-sm">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="text-gold-primary hover:text-gold-light font-semibold transition-colors">
          Créer un compte gratuit
        </Link>
      </p>

      {/* Premium promo */}
      <div className="mt-6 p-4 bg-gold-faint border border-gold-primary/20 rounded-xl">
        <p className="text-gold-light text-xs text-center">
          🏆 <strong>312 abonnés actifs</strong> font confiance à Elite Turf.{" "}
          <Link href="/abonnements" className="underline hover:text-gold-primary">
            Découvrir les offres
          </Link>
        </p>
      </div>
    </div>
  );
}
