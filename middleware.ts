import { createServerClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Routes qui doivent rester accessibles MÊME pour un user authentifié
 * sans téléphone (sinon on créerait une boucle infinie ou on bloquerait
 * des actions critiques).
 */
const PHONE_CHECK_BYPASS = [
  "/completer-profil",       // la page de complétion elle-même
  "/connexion",              // pour pouvoir se déconnecter / se reconnecter
  "/api/",                   // toutes les routes API
  "/auth/",                  // callbacks Supabase
  "/cgu",                    // pages légales
  "/confidentialite",
  "/mentions-legales",
  "/contact",
];

/**
 * Vérifie côté serveur si l'utilisateur a un téléphone valide en BDD.
 * Utilise le service_role pour bypasser les RLS (lecture publique d'1 champ).
 */
async function userHasPhone(userId: string): Promise<boolean> {
  try {
    const svc = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data } = await svc
      .from("profiles")
      .select("phone")
      .eq("id", userId)
      .maybeSingle();
    const phone = (data?.phone ?? "").trim();
    if (!phone) return false;
    // Au moins 8 chiffres → considéré valide (cohérent avec validation côté front)
    const digits = phone.replace(/\D/g, "");
    return digits.length >= 8;
  } catch {
    // En cas d'erreur (DB indisponible) → on ne bloque pas l'utilisateur
    return true;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Routes exclues du middleware (pas de vérification auth) ──
  const bypassRoutes = [
    "/auth/callback",       // échange du code Supabase PKCE
    "/api/cron/",           // cron jobs Vercel (sécurisés par CRON_SECRET)
    "/api/paiement/webhook", // webhook CinetPay (doit rester public)
    "/api/ingest/",          // endpoints d'ingestion MVP (auth propre MVP_API_SECRET)
  ];
  if (bypassRoutes.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Protect admin routes
  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!user) {
      return NextResponse.redirect(new URL("/connexion?redirect=/admin", request.url));
    }
  }

  // Protect premium content routes
  if (request.nextUrl.pathname.startsWith("/espace-membre")) {
    if (!user) {
      return NextResponse.redirect(new URL("/connexion", request.url));
    }
  }

  // ── Vérification téléphone obligatoire (post-inscription) ────────────
  // Tout user authentifié sans téléphone est redirigé vers /completer-profil
  // pour finaliser son inscription (Mobile Money + WhatsApp + anti-fraude).
  // Sauf si la requête est déjà sur une route bypass (API, callbacks, etc.).
  if (user && !PHONE_CHECK_BYPASS.some((r) => pathname.startsWith(r))) {
    const hasPhone = await userHasPhone(user.id);
    if (!hasPhone) {
      const url = new URL("/completer-profil", request.url);
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
