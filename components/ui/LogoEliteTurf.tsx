import Link from "next/link";
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

const sizeMap = {
  sm: {
    wrap:   "w-8 h-8",
    emoji:  "text-sm",
    elite:  "text-sm",
    turf:   "text-[10px]",
    gap:    "gap-2",
  },
  md: {
    wrap:   "w-9 h-9",
    emoji:  "text-base",
    elite:  "text-base",
    turf:   "text-xs",
    gap:    "gap-2",
  },
  lg: {
    wrap:   "w-9 h-9 sm:w-11 sm:h-11",
    emoji:  "text-base sm:text-lg",
    elite:  "text-lg sm:text-xl",
    turf:   "text-xs sm:text-sm",
    gap:    "gap-2 sm:gap-2.5",
  },
};

export default function LogoEliteTurf({
  size = "md",
  subtitle,
  href = "/",
  className,
}: LogoEliteTurfProps) {
  const s = sizeMap[size];

  const inner = (
    <span className={cn("flex items-center group", s.gap, className)}>
      {/* Horse icon circle */}
      <span
        className={cn(
          s.wrap,
          "rounded-full bg-gold-faint border border-gold-primary/40",
          "flex items-center justify-center flex-shrink-0",
          "group-hover:border-gold-primary transition-colors duration-200"
        )}
      >
        <span
          className={cn(s.emoji, "leading-none select-none")}
          role="img"
          aria-label="cheval de course"
        >
          🐎
        </span>
      </span>

      {/* Text stack */}
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-serif font-bold leading-tight",
            s.elite,
            "bg-clip-text text-transparent"
          )}
          style={{ backgroundImage: "linear-gradient(135deg, #C9A84C, #E8D5A3, #A07830)" }}
        >
          ELITE
        </span>
        <span
          className={cn(
            "font-serif font-semibold uppercase tracking-[0.18em] text-gold-light/70 leading-tight -mt-0.5",
            s.turf
          )}
        >
          TURF
        </span>
        {subtitle && (
          <span className="text-[10px] text-text-muted tracking-wider mt-0.5 font-sans normal-case">
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );

  return (
    <Link href={href} className="inline-flex">
      {inner}
    </Link>
  );
}
