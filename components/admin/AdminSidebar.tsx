"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, CalendarDays, Star, Users,
  CreditCard, Bell, Settings, LogOut, Menu, X, TrendingUp, Newspaper, Gift, Trophy, Zap, Brain,
  MessageCircle, Quote, PlayCircle, ListChecks, Gauge, Inbox, ChevronDown, Radar, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import LogoEliteTurf from "@/components/ui/LogoEliteTurf";

interface NavLink { href: string; icon: LucideIcon; label: string; exact?: boolean }
interface NavGroup { key: string; label: string; icon: LucideIcon; items: NavLink[] }

// Onglet d'accueil (toujours visible, en haut).
const DASHBOARD: NavLink = { href: "/admin", icon: LayoutDashboard, label: "Dashboard", exact: true };

// Sections repliables — la liste s'est allongée, on regroupe pour que tout tienne.
const GROUPS: NavGroup[] = [
  {
    key: "pronostics", label: "Pronostics", icon: Star,
    items: [
      { href: "/admin/pronostics",           icon: Star,        label: "Pronostics", exact: true },
      { href: "/admin/pronostics/bulk",      icon: Zap,         label: "Publier en masse" },
      { href: "/admin/pronostics/ai-review", icon: Brain,       label: "Revue IA Multi-Agents" },
      { href: "/admin/consensus",            icon: ListChecks,  label: "Consensus presse", exact: true },
      { href: "/admin/consensus/brouillons", icon: Inbox,       label: "Brouillons consensus" },
      { href: "/admin/banc-mesure",          icon: Gauge,       label: "Banc de mesure" },
      { href: "/admin/radar",                icon: Radar,       label: "Archive du Radar" },
      { href: "/admin/pronostic-gratuit",    icon: Gift,        label: "Pronostic Gratuit" },
    ],
  },
  {
    key: "courses", label: "Courses & résultats", icon: CalendarDays,
    items: [
      { href: "/admin/courses",   icon: CalendarDays, label: "Courses" },
      { href: "/admin/arrivees",  icon: Trophy,       label: "Arrivées & Rapports" },
      { href: "/admin/replays",   icon: PlayCircle,   label: "Replays" },
    ],
  },
  {
    key: "abonnes", label: "Abonnés & marketing", icon: Users,
    items: [
      { href: "/admin/utilisateurs",  icon: Users,         label: "Utilisateurs" },
      { href: "/admin/paiements",     icon: CreditCard,    label: "Paiements" },
      { href: "/admin/notifications", icon: Bell,          label: "Notifications" },
      { href: "/admin/whatsapp",      icon: MessageCircle, label: "WhatsApp Business" },
      { href: "/admin/newsletter",    icon: Newspaper,     label: "Newsletter" },
      { href: "/admin/temoignages",   icon: Quote,         label: "Témoignages" },
    ],
  },
];

// Onglets isolés du bas.
const TRAILING: NavLink[] = [
  { href: "/admin/statistiques", icon: TrendingUp, label: "Statistiques" },
  { href: "/admin/parametres",   icon: Settings,   label: "Paramètres" },
];

// Liste à plat (pour la désambiguïsation d'URL des préfixes).
let ALL_LINKS: NavLink[] = [DASHBOARD];
GROUPS.forEach((g) => { ALL_LINKS = ALL_LINKS.concat(g.items); });
ALL_LINKS = ALL_LINKS.concat(TRAILING);

export default function AdminSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    if (!pathname.startsWith(href)) return false;
    // Si une nav plus spécifique matche aussi, on la laisse gagner (préfixes).
    const moreSpecific = ALL_LINKS.some(
      (n) => n.href !== href && n.href.startsWith(href) && pathname.startsWith(n.href),
    );
    return !moreSpecific;
  };

  const groupHasActive = (g: NavGroup) => g.items.some((it) => isActive(it.href, it.exact));

  // Sections dépliées : par défaut, seule celle de la page courante est ouverte.
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    GROUPS.forEach((g) => { init[g.key] = g.items.some((it) => pathname.startsWith(it.href)); });
    return init;
  });

  // Ouvre la section de la page active en cas de navigation (sans refermer les autres).
  useEffect(() => {
    const active = GROUPS.filter((g) => g.items.some((it) => pathname.startsWith(it.href)))[0];
    if (active) setExpanded((prev) => (prev[active.key] ? prev : { ...prev, [active.key]: true }));
  }, [pathname]);

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
      active
        ? "bg-gold-faint border border-gold-primary/30 text-gold-light"
        : "text-text-secondary hover:text-text-primary hover:bg-bg-hover",
    );

  const renderLink = (item: NavLink, nested?: boolean) => {
    const active = isActive(item.href, item.exact);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setIsOpen(false)}
        className={cn(linkClass(active), nested && "pl-5 py-2 text-[13px]")}
      >
        <item.icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-gold-primary" : "")} />
        {item.label}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-bg-card border border-border rounded-lg text-text-secondary"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setIsOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-64 bg-bg-card border-r border-border z-40 flex flex-col",
          "transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Logo */}
        <div className="p-6 border-b border-border flex-shrink-0">
          <LogoEliteTurf size="sm" subtitle="Administration" />
        </div>

        {/* Navigation (défile si trop longue) */}
        <nav className="p-3 flex-1 overflow-y-auto min-h-0">
          <div className="space-y-1">
            {renderLink(DASHBOARD)}

            {GROUPS.map((g) => {
              const open = !!expanded[g.key];
              const hasActive = groupHasActive(g);
              return (
                <div key={g.key}>
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => ({ ...prev, [g.key]: !prev[g.key] }))}
                    aria-expanded={open}
                    className={cn(
                      "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-semibold transition-all",
                      hasActive && !open
                        ? "text-gold-light"
                        : "text-text-secondary hover:text-text-primary hover:bg-bg-hover",
                    )}
                  >
                    <g.icon className={cn("w-4 h-4 flex-shrink-0", hasActive ? "text-gold-primary" : "")} />
                    <span className="flex-1 text-left">{g.label}</span>
                    <ChevronDown className={cn("w-4 h-4 flex-shrink-0 transition-transform", open ? "" : "-rotate-90")} />
                  </button>
                  {open && (
                    <div className="mt-1 space-y-1 border-l border-border/60 ml-4">
                      {g.items.map((it) => renderLink(it, true))}
                    </div>
                  )}
                </div>
              );
            })}

            {TRAILING.map((it) => renderLink(it))}
          </div>
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-border flex-shrink-0">
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-status-loss hover:bg-status-loss/10 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Se déconnecter
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
