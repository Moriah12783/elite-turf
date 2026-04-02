"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, TrendingUp, BarChart2, Award, Trophy } from "lucide-react";

interface LiveStats {
  tauxGlobal:       number;   // ex: 76
  totalPronostics:  number;   // ex: 25
  meilleurRapport:  number | null; // ex: 93.20
  coursesAnalysees: number;   // ex: 112
}

export default function HeroSection() {
  const [scrollY,      setScrollY]      = useState(0);
  const [badgeVisible, setBadgeVisible] = useState(false);
  const [liveStats,    setLiveStats]    = useState<LiveStats | null>(null);
  const ticking = useRef(false);

  /* ── Parallax scroll tracker ── */
  useEffect(() => {
    const onScroll = () => {
      if (!ticking.current) {
        requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          ticking.current = false;
        });
        ticking.current = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ── Badge entrance animation ── */
  useEffect(() => {
    const t = setTimeout(() => setBadgeVisible(true), 300);
    return () => clearTimeout(t);
  }, []);

  /* ── Fetch live stats ── */
  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data: LiveStats) => setLiveStats(data))
      .catch(() => {});
  }, []);

  const parallaxY = scrollY * 0.35;

  /* ── Smart display : chaque badge choisit la meilleure valeur à montrer ── */
  const stats = [
    {
      icon: TrendingUp,
      value: liveStats
        ? liveStats.tauxGlobal > 0
          ? `${liveStats.tauxGlobal}%`
          : "—"
        : "…",
      label:    "Taux de réussite",
      sublabel: "historique prouvé",
      color:    "text-status-win",
    },
    {
      icon: BarChart2,
      value: liveStats
        ? liveStats.coursesAnalysees > 0
          ? `${liveStats.coursesAnalysees}+`
          : "…"
        : "…",
      label:    "Courses analysées",
      sublabel: "programmes PMU",
      color:    "text-gold-primary",
    },
    {
      icon: Award,
      value: "5 ans",
      label:    "D'expertise",
      sublabel: "pronostics hippiques",
      color:    "text-gold-light",
    },
    {
      icon: Trophy,
      value: liveStats
        ? liveStats.meilleurRapport
          ? `${liveStats.meilleurRapport.toFixed(0)}€`
          : liveStats.totalPronostics > 0
            ? `${liveStats.totalPronostics}`
            : "—"
        : "…",
      label: liveStats?.meilleurRapport
        ? "Meilleur rapport"
        : "Pronostics publiés",
      sublabel: liveStats?.meilleurRapport
        ? "rapport gagnant réel"
        : "analyses experts",
      color: "text-gold-primary",
    },
  ];

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">

      {/* ── Image plein écran — parallax ── */}
      <div
        className="absolute inset-0 z-0 will-change-transform"
        style={{
          backgroundImage: "url('/images/heroes/hero-courses.jpg')",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          backgroundPosition: `center calc(30% + ${parallaxY}px)`,
        }}
      />

      <div className="absolute inset-0 z-[1] bg-black/55" />
      <div className="absolute inset-0 z-[2] bg-gradient-to-b from-black/20 via-transparent to-bg-primary" />
      <div className="absolute inset-0 z-[2] bg-gradient-to-r from-black/35 via-transparent to-black/35" />
      <div className="absolute z-[3] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gold-primary/7 rounded-full blur-3xl pointer-events-none" />

      {/* ── CONTENU ── */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-32 sm:py-40 text-center">

        {/* ── Badge animé ── */}
        <div
          className="inline-flex items-center gap-2.5 px-5 py-2.5 bg-black/55 backdrop-blur-md border border-gold-primary/50 rounded-full mb-8 shadow-gold-sm transition-all duration-700"
          style={{
            opacity: badgeVisible ? 1 : 0,
            transform: badgeVisible ? "translateY(0) scale(1)" : "translateY(-10px) scale(0.95)",
          }}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-win opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-status-win" />
          </span>
          <span className="text-gold-light text-xs sm:text-sm font-semibold tracking-wide">
            🐎 Pronostics du jour disponibles
          </span>
          <span className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
            <span
              className="absolute top-0 left-[-100%] w-full h-full bg-gradient-to-r from-transparent via-gold-primary/20 to-transparent"
              style={{ animation: "badgeShimmer 3s ease-in-out infinite 1s" }}
            />
          </span>
        </div>

        {/* ── Titre ── */}
        <h1
          className="font-serif text-4xl sm:text-6xl lg:text-7xl font-bold leading-[1.1] mb-6 drop-shadow-2xl"
          style={{
            opacity: badgeVisible ? 1 : 0,
            transform: badgeVisible ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.8s ease 0.15s, transform 0.8s ease 0.15s",
          }}
        >
          <span className="text-white">EliteTurf : L&apos;Alliance de l&apos;Expertise Hippique</span>
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(135deg, #C9A84C, #F0E0B0, #A07830)" }}
          >
            et de la Précision Digitale
          </span>
        </h1>

        {/* ── Sous-titre ── */}
        <p
          className="text-white/75 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed drop-shadow-lg"
          style={{
            opacity: badgeVisible ? 1 : 0,
            transform: badgeVisible ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.8s ease 0.3s, transform 0.8s ease 0.3s",
          }}
        >
          Optimisez vos paris avec des pronostics de haut niveau.{" "}
          <span className="text-gold-light font-medium">
            Nous transformons les données en victoires pour les parieurs exigeants.
          </span>
        </p>

        {/* ── CTAs ── */}
        <div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          style={{
            opacity: badgeVisible ? 1 : 0,
            transform: badgeVisible ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.8s ease 0.45s, transform 0.8s ease 0.45s",
          }}
        >
          <Link
            href="/pronostics"
            className="flex items-center gap-2 px-8 py-4 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-base rounded-xl transition-all shadow-gold w-full sm:w-auto justify-center"
          >
            Découvrir la sélection du jour
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/abonnements"
            className="flex items-center gap-2 px-8 py-4 bg-black/40 backdrop-blur-sm hover:bg-black/60 border border-white/25 hover:border-gold-primary/50 text-white font-semibold text-base rounded-xl transition-all w-full sm:w-auto justify-center"
          >
            Nos Abonnements
          </Link>
        </div>

        {/* ── Stats grid (métriques crédibles, toujours vraies) ── */}
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-3xl mx-auto"
          style={{
            opacity: badgeVisible ? 1 : 0,
            transform: badgeVisible ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.8s ease 0.6s, transform 0.8s ease 0.6s",
          }}
        >
          {stats.map((stat, i) => (
            <div
              key={i}
              className="bg-black/45 backdrop-blur-sm border border-white/10 hover:border-gold-primary/40 rounded-xl p-4 transition-all group"
            >
              <stat.icon className={`w-5 h-5 ${stat.color} mb-2 mx-auto`} />
              <div className={`text-xl sm:text-2xl font-bold font-serif ${stat.color} group-hover:text-gold-light transition-colors`}>
                {stat.value}
              </div>
              <div className="text-xs text-white/60 font-medium">{stat.label}</div>
              <div className="text-xs text-white/40 mt-0.5 hidden sm:block">{stat.sublabel}</div>
            </div>
          ))}
        </div>

      </div>

      {/* ── Scroll indicator ── */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce z-10">
        <span className="text-white/40 text-[10px] tracking-widest uppercase">Défiler</span>
        <div className="w-px h-6 bg-gradient-to-b from-transparent to-gold-primary/60" />
        <div className="w-1.5 h-1.5 rounded-full bg-gold-primary/60" />
      </div>
    </section>
  );
}
