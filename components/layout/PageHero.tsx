interface PageHeroProps {
  image: string;
  titre: string;
  sousTitre?: string;
}

export default function PageHero({ image, titre, sousTitre }: PageHeroProps) {
  return (
    <div className="relative w-full h-[200px] md:h-[280px] overflow-hidden bg-[#0D0D14]">
      {/* Image en niveaux de gris très sombres — zéro teinte chaude */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover"
      style={{ filter: "grayscale(100%) brightness(0.42)" }}
      />
      {/* Overlay sombre uniforme */}
      <div className="absolute inset-0 bg-[#0D0D14]/55" />
      {/* Gradient bas vers fond */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0D0D14]/90" />

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
