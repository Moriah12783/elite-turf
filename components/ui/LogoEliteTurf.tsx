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

/** L'image logo.png est carrée (2000×2000) — on fixe la hauteur, la largeur suit */
const sizeMap = {
  sm: { height: 32 },   // admin sidebar
  md: { height: 40 },   // auth / footer
  lg: { height: 44 },   // navbar
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
        src="/images/logo.png"
        alt="Elite Turf"
        width={2000}
        height={2000}
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
