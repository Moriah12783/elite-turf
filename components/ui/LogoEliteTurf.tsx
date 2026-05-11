import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoEliteTurfProps {
  /** "sm" = admin sidebar, "md" = auth/footer, "lg" = navbar */
  size?: "sm" | "md" | "lg";
  /** Show the subtitle line below (Administration, etc.) */
  subtitle?: string;
  /** Make it a link (default: "/") */
  href?: string;
  className?: string;
}

/**
 * Logo Elite Turf — Variante navbar (transparent background, gold horseshoe).
 *
 * Migré du V1 (cheval marron + "elite-turf.fr" jaune) vers V2 (fer à cheval
 * or sur transparent + "ELITE TURF" blanc + "Pronostics PMU" en or).
 *
 * Le SVG transparent s'intègre nativement sur les fonds sombres (bg-bg-primary
 * du site = dark navy) sans avoir besoin de cadre/box.
 *
 * Pour les contextes fond clair (PDF, partenaires), utiliser plutôt
 * /images/logo-v2/logo-square-white.svg via une prop dédiée si besoin.
 */
const sizeMap = {
  sm: { height: 80 },    // admin sidebar
  md: { height: 96 },    // auth / footer
  lg: { height: 120 },   // navbar
};

export default function LogoEliteTurf({
  size = "md",
  subtitle,
  href = "/",
  className,
}: LogoEliteTurfProps) {
  const s = sizeMap[size];

  const inner = (
    <span className={cn("flex flex-col items-start group", className)}>
      <Image
        src="/images/logo-v2/logo-square-transparent.svg"
        alt="Elite Turf — Pronostics PMU"
        width={1000}
        height={1000}
        className="object-contain transition-opacity duration-200 group-hover:opacity-90"
        style={{ height: s.height, width: "auto" }}
        priority
      />
      {subtitle && (
        <span className="text-[10px] text-text-muted tracking-wider mt-1 font-sans normal-case pl-1">
          {subtitle}
        </span>
      )}
    </span>
  );

  return (
    <Link href={href} className="inline-flex">
      {inner}
    </Link>
  );
}
