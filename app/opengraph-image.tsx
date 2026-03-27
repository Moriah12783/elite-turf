import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Elite Turf — Pronostics PMU pour les parieurs francophones";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "linear-gradient(135deg, #0D0D14 0%, #161622 40%, #1A1628 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Gold accent lines */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "linear-gradient(90deg, transparent, #C9A84C, transparent)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 2,
            background: "linear-gradient(90deg, transparent, #C9A84C40, transparent)",
          }}
        />

        {/* Decorative circle */}
        <div
          style={{
            position: "absolute",
            top: -200,
            right: -200,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, #C9A84C08 0%, transparent 70%)",
            border: "1px solid #C9A84C10",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -150,
            left: -150,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, #C9A84C05 0%, transparent 70%)",
          }}
        />

        {/* Logo badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 32,
            padding: "12px 28px",
            background: "#C9A84C15",
            border: "1px solid #C9A84C30",
            borderRadius: 50,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#C9A84C",
            }}
          />
          <span style={{ color: "#C9A84C", fontSize: 18, fontWeight: 700, letterSpacing: 4 }}>
            ELITE TURF
          </span>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#C9A84C",
            }}
          />
        </div>

        {/* Main title */}
        <h1
          style={{
            color: "#F5F5F0",
            fontSize: 72,
            fontWeight: 800,
            textAlign: "center",
            lineHeight: 1.1,
            margin: "0 0 8px 0",
            letterSpacing: -1,
          }}
        >
          Les Pronostics
        </h1>
        <h2
          style={{
            background: "linear-gradient(90deg, #C9A84C, #E8C870, #C9A84C)",
            backgroundClip: "text",
            color: "transparent",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            fontSize: 72,
            fontWeight: 800,
            textAlign: "center",
            lineHeight: 1.1,
            margin: "0 0 28px 0",
          }}
        >
          Qui Font la Différence
        </h2>

        {/* Subtitle */}
        <p
          style={{
            color: "#9898B0",
            fontSize: 26,
            textAlign: "center",
            margin: "0 0 40px 0",
            maxWidth: 800,
            lineHeight: 1.5,
          }}
        >
          Tiercé · Quarté+ · Quinté+ — Analyses d&apos;experts depuis Paris
          <br />
          pour les parieurs francophones
        </p>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            gap: 24,
          }}
        >
          {[
            { value: "73%", label: "Taux de réussite" },
            { value: "847+", label: "Membres actifs" },
            { value: "9,90€", label: "À partir de /mois" },
          ].map((stat, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "16px 32px",
                background: "#161622",
                border: "1px solid #2A2A3E",
                borderRadius: 16,
                minWidth: 180,
              }}
            >
              <span
                style={{
                  color: "#C9A84C",
                  fontSize: 36,
                  fontWeight: 800,
                  lineHeight: 1,
                }}
              >
                {stat.value}
              </span>
              <span
                style={{
                  color: "#6A6A80",
                  fontSize: 15,
                  marginTop: 6,
                }}
              >
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        {/* Bottom domain */}
        <div
          style={{
            position: "absolute",
            bottom: 28,
            color: "#4A4A60",
            fontSize: 18,
            letterSpacing: 2,
          }}
        >
          eliteturf.fr
        </div>
      </div>
    ),
    { ...size }
  );
}
