"use client";

import { useState, useEffect, useRef } from "react";
import { X, Gift, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

/**
 * Exit-intent popup — se déclenche quand la souris quitte la fenêtre
 * vers le haut (direction barre navigateur = intention de fermer).
 * S'affiche une seule fois par session.
 */
export default function ExitIntentPopup() {
  const [open, setOpen]       = useState(false);
  const [email, setEmail]     = useState("");
  const [status, setStatus]   = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError]     = useState("");
  const triggered             = useRef(false);

  useEffect(() => {
    // Ne pas réafficher si déjà vu dans cette session
    if (sessionStorage.getItem("exit-intent-shown") === "1") return;

    // Sur mobile : détecter scroll vers le haut rapide (simuler exit-intent)
    let lastY = window.scrollY;
    const onScrollMobile = () => {
      const currentY = window.scrollY;
      if (lastY - currentY > 80 && currentY < 200 && !triggered.current) {
        trigger();
      }
      lastY = currentY;
    };

    // Sur desktop : détecter sortie en haut de la fenêtre
    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 10 && !triggered.current) {
        trigger();
      }
    };

    // Délai minimum de 8 secondes avant d'afficher
    const timer = setTimeout(() => {
      document.addEventListener("mouseleave", onMouseLeave);
      window.addEventListener("scroll", onScrollMobile, { passive: true });
    }, 8000);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("scroll", onScrollMobile);
    };
  }, []);

  function trigger() {
    triggered.current = true;
    sessionStorage.setItem("exit-intent-shown", "1");
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source: "exit-intent" }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Une erreur s'est produite.");
        setStatus("error");
      } else {
        setStatus("success");
      }
    } catch {
      setError("Erreur de connexion. Réessayez.");
      setStatus("error");
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
        onClick={close}
        aria-hidden="true"
      />

      {/* Popup */}
      <div
        className="fixed inset-0 z-[101] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Guide gratuit Elite Turf"
      >
        <div className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-fade-in">

          {/* Header image / gradient */}
          <div className="relative h-36 bg-gradient-to-br from-[#0D1B2A] to-[#0F2A1E] flex items-center justify-center overflow-hidden">
            {/* Motif décoratif */}
            <div className="absolute inset-0 opacity-20"
              style={{ backgroundImage: "radial-gradient(circle at 30% 50%, #C9A84C 0%, transparent 60%), radial-gradient(circle at 70% 50%, #C9A84C 0%, transparent 60%)" }}
            />
            <div className="relative text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-gold-primary/20 border border-gold-primary/40 flex items-center justify-center mx-auto mb-2">
                <Gift className="w-7 h-7 text-gold-primary" />
              </div>
              <p className="text-gold-primary font-bold text-xs uppercase tracking-widest">Offre exclusive</p>
            </div>

            {/* Bouton fermer */}
            <button
              onClick={close}
              aria-label="Fermer"
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Corps */}
          <div className="bg-bg-elevated p-6 border-t border-gold-primary/20">
            {status === "success" ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-12 h-12 text-status-win mx-auto mb-3" />
                <h2 className="font-serif font-bold text-text-primary text-xl mb-2">
                  C&apos;est dans votre boîte ! 🏆
                </h2>
                <p className="text-text-secondary text-sm mb-4">
                  Vérifiez votre email — vos 5 Secrets d&apos;Experts arrivent dans les prochaines minutes.
                </p>
                <button
                  onClick={close}
                  className="px-6 py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-colors"
                >
                  Continuer la lecture
                </button>
              </div>
            ) : (
              <>
                <h2 className="font-serif font-bold text-text-primary text-xl leading-tight mb-2">
                  Ne partez pas sans vos{" "}
                  <span className="text-gold-primary">5 Secrets d&apos;Experts</span>
                </h2>
                <p className="text-text-secondary text-sm mb-4">
                  Téléchargez notre guide gratuit : les méthodes utilisées par nos analystes pour identifier les gagnants chaque matin à Paris.
                </p>

                {/* Les 5 secrets */}
                <ul className="space-y-1.5 mb-5">
                  {[
                    "Lire la musique d'un cheval en 30 secondes",
                    "Le signal secret du Déferrage D4",
                    "Le duo Jockey-Entraîneur qui gagne 30% de plus",
                    "Terrain et corde : l'erreur que 90% font",
                    "Gérer sa bankroll comme un pro",
                  ].map((secret, i) => (
                    <li key={secret} className="flex items-start gap-2 text-xs text-text-secondary">
                      <span className="w-4 h-4 rounded-full bg-gold-primary/20 text-gold-primary font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      {secret}
                    </li>
                  ))}
                </ul>

                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    required
                    disabled={status === "loading"}
                    className="w-full px-4 py-3 bg-bg-primary border border-border rounded-xl text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-gold-primary/60 focus:ring-1 focus:ring-gold-primary/30 transition-colors disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={status === "loading" || !email.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold-sm disabled:opacity-50"
                  >
                    {status === "loading" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Recevoir le guide gratuit
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                  {status === "error" && (
                    <p className="text-status-loss text-xs text-center">{error}</p>
                  )}
                </form>

                <button
                  onClick={close}
                  className="w-full mt-3 text-text-muted text-xs hover:text-text-secondary transition-colors"
                >
                  Non merci, je préfère parier sans méthode
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
