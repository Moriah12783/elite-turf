"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  value: number;
  suffix?: string;
  prefix?: string;
  duration?: number; // ms
  className?: string;
}

export default function AnimatedCounter({
  value,
  suffix = "",
  prefix = "",
  duration = 1200,
  className = "",
}: Props) {
  const [display, setDisplay] = useState(0);
  const startRef  = useRef<number | null>(null);
  const frameRef  = useRef<number>(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      // Delay slightly so it's visible
      const timeout = setTimeout(() => {
        mountedRef.current = true;
        const animate = (ts: number) => {
          if (!startRef.current) startRef.current = ts;
          const elapsed = ts - startRef.current;
          const progress = Math.min(elapsed / duration, 1);
          // Ease out cubic
          const eased = 1 - Math.pow(1 - progress, 3);
          setDisplay(Math.round(eased * value));
          if (progress < 1) {
            frameRef.current = requestAnimationFrame(animate);
          }
        };
        frameRef.current = requestAnimationFrame(animate);
      }, 300);
      return () => {
        clearTimeout(timeout);
        cancelAnimationFrame(frameRef.current);
      };
    }
  }, [value, duration]);

  return (
    <span className={className}>
      {prefix}{display.toLocaleString("fr-CI")}{suffix}
    </span>
  );
}
