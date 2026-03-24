"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Menu, X, Star, LogIn, User, ChevronDown, LogOut, Crown, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import LogoEliteTurf from "@/components/ui/LogoEliteTurf";
import { createClient } from "@/lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export default function Navbar() {
  const [isOpen, setIsOpen]         = useState(false);
  const [scrolled, setScrolled]     = useState(false);
  const [user, setUser]             = useState<SupabaseUser | null>(null);
  const [dropdownOpen, setDropdown] = useState(false);
  const dropdownRef                  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Auth state
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setDropdown(false);
    window.location.href = "/";
  }

  const prenom = user?.user_metadata?.nom_complet?.split(" ")[0] || user?.email?.split("@")[0] || "Mon compte";

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
      scrolled ? "bg-bg-primary/95 backdrop-blur-md border-b border-border" : "bg-transparent"
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
          <LogoEliteTurf size="lg" />

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <NavLink href="/pronostics">Pronostics</NavLink>
            <NavLink href="/courses">Courses du jour</NavLink>
            <NavLink href="/performances">Nos résultats</NavLink>
            <NavLink href="/abonnements">Abonnements</NavLink>
            <NavLink href="/blog">Blog PMU</NavLink>
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              /* ── Utilisateur connecté ── */
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdown(!dropdownOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-card border border-gold-primary/30 hover:border-gold-primary/60 transition-all text-sm font-medium text-gold-light"
                >
                  <div className="w-6 h-6 rounded-full bg-gold-primary/20 flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-gold-primary" />
                  </div>
                  <span className="max-w-[100px] truncate">{prenom}</span>
                  <ChevronDown className={cn("w-3.5 h-3.5 text-gold-primary transition-transform", dropdownOpen && "rotate-180")} />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-bg-card border border-border rounded-xl shadow-card overflow-hidden z-50 animate-slide-up">
                    <div className="px-4 py-3 border-b border-border/50">
                      <p className="text-text-primary text-sm font-semibold truncate">{prenom}</p>
                      <p className="text-text-muted text-xs truncate">{user.email}</p>
                    </div>
                    <div className="py-1">
                      {[
                        { href: "/espace-membre",  label: "Mon espace",        Icon: User    },
                        { href: "/abonnements",    label: "Mes abonnements",   Icon: Crown   },
                        { href: "/pronostics",     label: "Mes pronostics",    Icon: Star    },
                        { href: "/blog",           label: "Blog PMU",          Icon: BookOpen},
                      ].map(({ href, label, Icon }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setDropdown(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-text-secondary hover:text-gold-light hover:bg-bg-elevated text-sm transition-colors"
                        >
                          <Icon className="w-4 h-4 text-gold-primary/60" />
                          {label}
                        </Link>
                      ))}
                    </div>
                    <div className="border-t border-border/50 py-1">
                      <button
                        onClick={handleSignOut}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-status-loss hover:bg-status-loss/10 text-sm transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Se déconnecter
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ── Non connecté ── */
              <>
                <Link
                  href="/connexion"
                  className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors text-sm font-medium"
                >
                  <LogIn className="w-4 h-4" />
                  Connexion
                </Link>
                <Link
                  href="/inscription"
                  className="flex items-center gap-2 px-4 py-2 bg-gold-primary hover:bg-gold-dark text-bg-primary font-semibold text-sm rounded-lg transition-colors shadow-gold-sm"
                >
                  <Star className="w-4 h-4" />
                  S&apos;abonner
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Menu"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-bg-card border-t border-border animate-fade-in">
          <div className="px-4 py-4 space-y-1">
            {[
              { href: "/pronostics",  label: "Pronostics"    },
              { href: "/courses",     label: "Courses du jour"},
              { href: "/performances",label: "Nos résultats" },
              { href: "/abonnements", label: "Abonnements"   },
              { href: "/blog",        label: "Blog PMU"      },
            ].map(({ href, label }) => (
              <MobileNavLink key={href} href={href} onClick={() => setIsOpen(false)}>
                {label}
              </MobileNavLink>
            ))}
            <hr className="gold-divider my-3" />
            {user ? (
              <>
                <Link href="/espace-membre" onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 py-3 text-gold-light text-sm font-semibold">
                  <User className="w-4 h-4" /> Bonjour, {prenom}
                </Link>
                <button onClick={handleSignOut}
                  className="block w-full text-left py-3 text-status-loss text-sm font-medium transition-colors">
                  Se déconnecter
                </button>
              </>
            ) : (
              <>
                <Link href="/connexion" onClick={() => setIsOpen(false)}
                  className="block py-3 text-text-secondary hover:text-text-primary text-sm font-medium transition-colors">
                  Connexion
                </Link>
                <Link href="/inscription" onClick={() => setIsOpen(false)}
                  className="block w-full text-center py-3 bg-gold-primary hover:bg-gold-dark text-bg-primary font-semibold text-sm rounded-lg transition-colors">
                  S&apos;abonner maintenant
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-text-secondary hover:text-text-primary text-sm font-medium transition-colors relative group">
      {children}
      <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gold-primary group-hover:w-full transition-all duration-300" />
    </Link>
  );
}

function MobileNavLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link href={href} onClick={onClick}
      className="block py-3 text-text-primary hover:text-gold-light text-sm font-medium border-b border-border/50 transition-colors">
      {children}
    </Link>
  );
}
