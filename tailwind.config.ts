import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#1C1C1C",
          card: "#161622",
          hover: "#1E1E2E",
          elevated: "#1A1A28",
        },
        gold: {
          primary: "#C9A84C",
          light: "#E8D5A3",
          dark: "#A07830",
          faint: "#C9A84C1A",
        },
        racing: {
          green: "#1B5E20",
          "green-light": "#2E7D32",
          "green-faint": "#1B5E201A",
        },
        border: {
          DEFAULT: "#2A2A3E",
          gold: "#C9A84C40",
          light: "#3A3A50",
        },
        text: {
          primary: "#F5F5F0",
          secondary: "#9090A0",
          muted: "#606070",
        },
        status: {
          win: "#22C55E",
          loss: "#EF4444",
          partial: "#F59E0B",
          pending: "#6B7280",
        }
      },
      fontFamily: {
        serif: ["Playfair Display", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg, #C9A84C, #E8D5A3, #A07830)",
        "dark-gradient": "linear-gradient(180deg, #1C1C1C 0%, #161622 100%)",
        "hero-overlay": "linear-gradient(180deg, rgba(26,26,46,0.3) 0%, rgba(26,26,46,0.85) 60%, #1C1C1C 100%)",
        "card-gradient": "linear-gradient(135deg, #161622 0%, #1E1E2E 100%)",
        "gold-line": "linear-gradient(90deg, transparent, #C9A84C, transparent)",
      },
      boxShadow: {
        gold: "0 0 20px rgba(201, 168, 76, 0.15)",
        "gold-sm": "0 0 10px rgba(201, 168, 76, 0.1)",
        card: "0 4px 24px rgba(0,0,0,0.4)",
        "card-hover": "0 8px 40px rgba(0,0,0,0.6)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-in-out",
        "slide-up": "slideUp 0.4s ease-out",
        "pulse-gold": "pulseGold 2s infinite",
        "shimmer": "shimmer 2s infinite linear",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseGold: {
          "0%, 100%": { boxShadow: "0 0 10px rgba(201, 168, 76, 0.2)" },
          "50%": { boxShadow: "0 0 25px rgba(201, 168, 76, 0.5)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
