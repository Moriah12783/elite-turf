import Navbar from "@/components/layout/Navbar";
import TickerBar from "@/components/layout/TickerBar";
import Footer from "@/components/layout/Footer";
import ScrollToTop from "@/components/layout/ScrollToTop";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <TickerBar />
      <main>{children}</main>
      <Footer />
      <ScrollToTop />
    </>
  );
}
