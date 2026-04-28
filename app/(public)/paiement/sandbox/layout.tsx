import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Paiement sandbox — Elite Turf",
};

export default async function SandboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/connexion?redirect=/paiement/sandbox");

  return <>{children}</>;
}
