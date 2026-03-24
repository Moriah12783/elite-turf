import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Étape 1 : vérifier que l'utilisateur est connecté (via session cookie)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/connexion?redirect=/admin");

  // Étape 2 : vérifier le rôle ADMIN via le service client (bypass RLS)
  // On utilise la service_role key pour éviter les blocages RLS sur profiles
  const adminClient = createServiceClient();
  const { data: profile, error } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Debug : si erreur de lecture du profil, on log pour diagnostic
  if (error) {
    console.error("[AdminLayout] Erreur lecture profil:", error.message);
  }

  if (!profile || profile.role !== "ADMIN") redirect("/");

  return (
    <div className="min-h-screen bg-bg-primary flex">
      <AdminSidebar />
      <main className="flex-1 ml-0 lg:ml-64 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
}
