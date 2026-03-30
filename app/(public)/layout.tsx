import Navbar from "@/components/layout/Navbar";
import TickerBar from "@/components/layout/TickerBar";
import Footer from "@/components/layout/Footer";
import ScrollToTop from "@/components/layout/ScrollToTop";
import DynamicPageBackground from "@/components/layout/DynamicPageBackground";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {/* Fond subtil dynamique par page — zéro impact sur le contenu */}
      <DynamicPageBackground />

      {/* Tout le contenu au-dessus du fond */}
      <div className="relative" style={{ zIndex: 1 }}>
        <Navbar />
        <TickerBar />
        <main>{children}</main>
        <Footer />
        <ScrollToTop />
      </div>
    </div>
  );
}
