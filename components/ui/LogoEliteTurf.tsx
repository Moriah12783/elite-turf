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

const sizeMap = {
  sm: { width: 100, height: 34 },
  md: { width: 120, height: 40 },
  lg: { width: 150, height: 50 },
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
      <span className="bg-white rounded-xl px-2 py-1 transition-opacity duration-200 group-hover:opacity-90 inline-flex items-center justify-center">
        <Image
          src="/images/logo.png"
          alt="Elite Turf"
          width={s.width}
          height={s.height}
          className="object-contain"
          priority
        />
      </span>
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
