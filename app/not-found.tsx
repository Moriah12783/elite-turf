import Link from "next/link";
import { Search, Home, Star } from "lucide-react";
import LogoEliteTurf from "@/components/ui/LogoEliteTurf";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center px-4 text-center">

      {/* Logo */}
      <div className="mb-10">
        <LogoEliteTurf size="lg" href="/" />
      </div>

      {/* 404 stylisé */}
      <div className="relative mb-8">
        <p
          className="text-[120px] sm:text-[160px] font-serif font-bold leading-none select-none"
          style={{
            backgroundImage: "linear-gradient(135deg, #C9A84C22, #C9A84C66, #C9A84C22)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          404
        </p>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gold-faint border border-gold-primary/30 flex items-center justify-center">
            <Search className="w-8 h-8 text-gold-primary" />
          </div>
        </div>
      </div>

      <h1 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-3">
        Page introuvable
      </h1>
      <p className="text-text-secondary text-base max-w-md mb-10 leading-relaxed">
        Cette page n&apos;existe pas ou a été déplacée. Nos pronostics PMU,
        eux, sont toujours disponibles.
      </p>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 px-6 py-3 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold"
        >
          <Home className="w-4 h-4" />
          Retour à l&apos;accueil
        </Link>
        <Link
          href="/pronostics"
          className="flex items-center gap-2 px-6 py-3 bg-bg-card border border-gold-primary/30 hover:border-gold-primary/60 text-gold-light font-bold text-sm rounded-xl transition-all"
        >
          <Star className="w-4 h-4" />
          Voir les pronostics PMU
        </Link>
      </div>

      <p className="mt-8 text-text-muted text-xs">
        Elite Turf · Paris, France · Pronostics PMU pour les parieurs francophones
      </p>

    </div>
  );
}
