"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, CalendarDays, Star, Users,
  CreditCard, Bell, Settings, LogOut, Menu, X, TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import LogoEliteTurf from "@/components/ui/LogoEliteTurf";

const navItems = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/admin/courses", icon: CalendarDays, label: "Courses" },
  { href: "/admin/pronostics", icon: Star, label: "Pronostics" },
  { href: "/admin/utilisateurs", icon: Users, label: "Utilisateurs" },
  { href: "/admin/paiements", icon: CreditCard, label: "Paiements" },
  { href: "/admin/notifications", icon: Bell, label: "Notifications" },
  { href: "/admin/statistiques", icon: TrendingUp, label: "Statistiques" },
  { href: "/admin/parametres", icon: Settings, label: "Paramètres" },
];

export default function AdminSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

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
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-64 bg-bg-card border-r border-border z-40",
          "transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <LogoEliteTurf size="sm" subtitle="Administration" />
        </div>

        {/* Navigation */}
        <nav className="p-3 flex-1 overflow-y-auto">
          <div className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive(item.href, item.exact)
                    ? "bg-gold-faint border border-gold-primary/30 text-gold-light"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                )}
              >
                <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive(item.href, item.exact) ? "text-gold-primary" : "")} />
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-border">
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
