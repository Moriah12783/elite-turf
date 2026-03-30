import { NextRequest, NextResponse } from "next/server";

const ONESIGNAL_APP_ID  = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_REST_API_KEY;
const APP_URL           = process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.fr";

// POST — envoyer une notification
export async function POST(req: NextRequest) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
    return NextResponse.json(
      { error: "OneSignal non configuré — ajoutez NEXT_PUBLIC_ONESIGNAL_APP_ID et ONESIGNAL_REST_API_KEY dans Vercel" },
      { status: 503 }
    );
  }

  const { titre, message, segment } = await req.json();

  if (!titre?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Titre et message requis" }, { status: 400 });
  }

  const body: Record<string, unknown> = {
    app_id:   ONESIGNAL_APP_ID,
    headings: { en: titre, fr: titre },
    contents: { en: message, fr: message },
    url:      APP_URL + "/pronostics",
  };

  // Ciblage par segment (via tags OneSignal)
  if (segment === "premium") {
    body.filters = [{ field: "tag", key: "abonnement", relation: "=", value: "PREMIUM" }];
  } else if (segment === "vip") {
    body.filters = [{ field: "tag", key: "abonnement", relation: "=", value: "VIP" }];
  } else if (segment === "gratuit") {
    body.filters = [{ field: "tag", key: "abonnement", relation: "=", value: "GRATUIT" }];
  } else if (segment === "expires") {
    body.filters = [{ field: "tag", key: "abonnement", relation: "=", value: "EXPIRE" }];
  } else {
    body.included_segments = ["All"];
  }

  const res = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Basic ${ONESIGNAL_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { error: data.errors?.[0] || "Erreur lors de l'envoi OneSignal" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success:    true,
    id:         data.id,
    recipients: data.recipients ?? 0,
  });
}

// GET — récupérer l'historique des notifications
export async function GET() {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
    return NextResponse.json({ notifications: [] });
  }

  const res = await fetch(
    `https://onesignal.com/api/v1/notifications?app_id=${ONESIGNAL_APP_ID}&limit=20`,
    {
      headers: { "Authorization": `Basic ${ONESIGNAL_API_KEY}` },
      next: { revalidate: 60 },
    }
  );

  if (!res.ok) return NextResponse.json({ notifications: [] });

  const data = await res.json();
  return NextResponse.json({ notifications: data.notifications || [] });
}
