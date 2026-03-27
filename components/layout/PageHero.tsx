"use client";

import Image from "next/image";

interface PageHeroProps {
  image: string;
  titre: string;
  sousTitre?: string;
}

export default function PageHero({ image, titre, sousTitre }: PageHeroProps) {
  return (
    <div className="relative w-full h-[200px] sm:h-[280px] overflow-hidden">
      <Image
        src={image}
        alt={titre}
        fill
        priority
        className="object-cover object-center"
        sizes="100vw"
      />
      {/* Overlay sombre 45% */}
      <div className="absolute inset-0 bg-black/45" />
      {/* Gradient bas pour transition douce */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg-primary/60" />

      {/* Contenu centré */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-px bg-gold-primary/70" />
          <div className="w-2 h-2 rounded-full bg-gold-primary" />
          <div className="w-8 h-px bg-gold-primary/70" />
        </div>
        <h1 className="font-serif text-2xl sm:text-4xl font-bold text-white drop-shadow-lg tracking-tight">
          {titre}
        </h1>
        {sousTitre && (
          <p className="mt-2 text-gray-300 text-sm sm:text-base max-w-xl leading-relaxed drop-shadow">
            {sousTitre}
          </p>
        )}
      </div>
    </div>
  );
}
