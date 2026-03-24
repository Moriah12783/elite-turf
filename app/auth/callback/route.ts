import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sendEmail } from "@/lib/email";
import { templateBienvenue } from "@/lib/email/templates/bienvenue";

/**
 * Callback Supabase Auth (PKCE flow)
 * Supabase redirige ici après confirmation d'email.
 * On échange le code contre une session puis on redirige.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/pronostics";

  if (!code) {
    return NextResponse.redirect(`${origin}/connexion?error=missing_code`);
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
          );
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("[auth/callback] Erreur échange code:", error);
    return NextResponse.redirect(`${origin}/connexion?error=auth_callback_error`);
  }

  // ── Envoyer l'email de bienvenue (best-effort, non-bloquant) ──
  const user = data.user;
  const nomComplet =
    user.user_metadata?.nom_complet ||
    user.email?.split("@")[0] ||
    "Champion";

  try {
    const { subject, html } = templateBienvenue({
      nomComplet,
      email: user.email ?? "",
    });

    await sendEmail({
      to: user.email ?? "",
      subject,
      html,
    });
  } catch (emailErr) {
    // Ne pas bloquer la connexion si l'email échoue
    console.error("[auth/callback] Email bienvenue échoué:", emailErr);
  }

  // ── Rediriger vers la destination ──
  return NextResponse.redirect(`${origin}${next}`);
}
