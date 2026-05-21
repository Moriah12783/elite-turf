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

/**
 * Pattern UUID v4 utilisé par Supabase pour les IDs `courses`.
 * Ex: `f1d83877-5c85-453a-862d-2f6c6bea7b64`.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Détecte un bot moteur de recherche (User-Agent). Liste non-exhaustive mais
 * couvre 99% du trafic crawl pertinent pour notre SEO.
 */
const BOT_UA_RE = /(googlebot|bingbot|duckduckbot|yandex(bot)?|baiduspider|facebookexternalhit|twitterbot|linkedinbot|applebot|petalbot|semrushbot|ahrefsbot)/i;

/**
 * Vérifie en BDD si une course existe (juste l'id, requête ultra-rapide via PK).
 * Utilisé uniquement par le middleware pour les requêtes bot — pas par les users
 * (qui passent par page.tsx normalement). On `try/catch` agressivement pour ne
 * jamais bloquer un crawl en cas d'incident DB.
 */
async function courseExists(courseId: string): Promise<boolean> {
  try {
    const svc = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data } = await svc
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .maybeSingle();
    return data !== null;
  } catch {
    // En cas d'erreur DB : on assume "existe" pour ne pas générer de faux 410
    return true;
  }
}

/**
 * Construit une réponse HTTP 410 Gone minimale pour les bots.
 * 410 signale à Google "URL volontairement supprimée, dé-indexe vite" → ~7 jours
 * de dé-indexation au lieu de ~30 jours pour un 404 standard.
 */
function build410Response(courseId: string): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="googlebot" content="noindex, nofollow">
<title>Course retirée — Elite Turf</title>
<link rel="canonical" href="https://www.elite-turf.fr/courses">
</head>
<body>
<h1>Cette course n'est plus disponible (410 Gone)</h1>
<p>La course <code>${courseId}</code> a été retirée de notre base. Voir le <a href="https://www.elite-turf.fr/courses">programme du jour</a> ou les <a href="https://www.elite-turf.fr/pronostics">pronostics</a>.</p>
</body>
</html>`;
  return new NextResponse(html, {
    status: 410,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Redirection non-www → www (308 Permanent) ─────────────────────────
  // Consolidation du domaine canonique sur https://www.elite-turf.fr.
  //
  // Historique : précédemment implémenté via next.config.js `redirects()`
  // avec `source: "/:path*"` + `destination: "https://www.elite-turf.fr/:path*"`.
  // Bug détecté 2026-05-18 : sur OpenNext + Next.js 14.2, la substitution
  // de `:path*` échoue pour la requête RACINE seulement → le header
  // Location contenait le pattern littéral `https://www.elite-turf.fr/:path*`
  // (vérifié via `curl -sI https://elite-turf.fr/`). Les paths non-vides
  // (/abonnements, /pronostics, etc.) étaient correctement substitués.
  //
  // Solution : déplacer la redirection ici. Le middleware s'exécute avant
  // `redirects()` et gère tous les cas sans la friction path-to-regexp.
  // URL.clone() préserve automatiquement pathname + search + hash.
  const host = request.headers.get("host");
  if (host === "elite-turf.fr") {
    const url = request.nextUrl.clone();
    url.host = "www.elite-turf.fr";
    return NextResponse.redirect(url, 308);
  }

  // ── HTTP 410 Gone pour les /courses/<uuid> absents (SEO bot-only) ─────
  // GSC 18/05/2026 : 123 pages /courses/<uuid> en "Introuvable (404)" malgré
  // le not-found.tsx avec robots:noindex. Google retient les 404 ~30 jours
  // avant dé-indexation définitive. Avec un vrai 410 → ~7 jours.
  //
  // Stratégie : seulement pour les bots search (Googlebot, Bingbot, etc.)
  // pour éviter d'ajouter une query Supabase à chaque request utilisateur.
  // Les real users tombent sur le not-found.tsx existant (404 + noindex),
  // qui reste l'expérience attendue côté UX.
  if (pathname.startsWith("/courses/")) {
    const courseId = pathname.slice("/courses/".length).replace(/\/$/, "");
    const ua = request.headers.get("user-agent") || "";
    if (UUID_RE.test(courseId) && BOT_UA_RE.test(ua)) {
      const exists = await courseExists(courseId);
      if (!exists) {
        return build410Response(courseId);
      }
    }
  }

  // ── Catch malformed URLs (SEO fix Google Search Console) ──────────────
  // GSC a détecté des URLs comme /https://www.elite-turf.fr/courses (2 cas)
  // probablement issues d'un href cassé ou d'un crawl externe mal formé.
  // On les capture ici et on redirige vers la home en 301 permanent → Google
  // déduit que l'URL doit être supprimée de l'index.
  //
  // Patterns capturés :
  //   /http:...        /https:...        /http%3A...        /https%3A...
  //   /\\http...       /\\https...       (encodage Windows-style)
  //   N'importe quel pathname contenant "://" (URL imbriquée).
  if (
    /^\/(https?:|https?%3A|\\https?:?)/i.test(pathname) ||
    pathname.includes("://") ||
    pathname.includes(":%2F%2F")
  ) {
    return NextResponse.redirect(new URL("/", request.url), 301);
  }

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
