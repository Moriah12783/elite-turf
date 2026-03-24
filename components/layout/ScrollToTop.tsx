"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <button
      onClick={scrollTop}
      aria-label="Retour en haut"
      className={`
        fixed bottom-6 right-6 z-50
        w-11 h-11 rounded-full
        bg-gold-primary hover:bg-gold-dark
        text-bg-primary
        flex items-center justify-center
        shadow-gold transition-all duration-300
        ${visible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"}
      `}
    >
      <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
    </button>
  );
}
