interface PageHeroProps {
  image: string;
  titre: string;
  sousTitre?: string;
}

export default function PageHero({ image, titre, sousTitre }: PageHeroProps) {
  return (
    <div className="relative w-full h-[200px] md:h-[280px] overflow-hidden bg-[#1C1C1C]">
      {/* Background image via CSS inline — grayscale + assombri */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url('${image}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "brightness(0.75)",
        }}
      />
      {/* Overlay noir 50% */}
      <div className="absolute inset-0 bg-black/30" />
      {/* Gradient bas vers fond */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#1C1C1C]/90" />

      {/* Contenu centré */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-px w-8 bg-amber-400/80" />
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <div className="h-px w-8 bg-amber-400/80" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg tracking-tight">
          {titre}
        </h1>
        {sousTitre && (
          <p className="mt-2 text-gray-300 text-sm md:text-base max-w-xl leading-relaxed drop-shadow">
            {sousTitre}
          </p>
        )}
      </div>
    </div>
  );
}
