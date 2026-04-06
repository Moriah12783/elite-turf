import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.elite-turf.fr";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#ffffff",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "6px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${APP_URL}/images/logo.png`}
          width={28}
          height={28}
          style={{ objectFit: "contain" }}
          alt="Elite Turf"
        />
      </div>
    ),
    { ...size }
  );
}
