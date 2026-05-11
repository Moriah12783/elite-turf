-- ──────────────────────────────────────────────────────────────────────
-- 20260511 — Fix de la récursion RLS sur la table `profiles`
-- ──────────────────────────────────────────────────────────────────────
--
-- Migration appliquée en prod le 2026-05-11 via Supabase MCP.
-- Tracée ici pour le contrôle de version + rejouabilité en staging/local.
--
-- ── Contexte du bug ─────────────────────────────────────────────────────
--
-- La policy "Admins can view all profiles" utilisait :
--   USING (
--     EXISTS (SELECT 1 FROM profiles
--             WHERE id = auth.uid() AND role = 'ADMIN')
--   )
--
-- Cette sous-requête sur `profiles` re-déclenche la policy → récursion ∞.
-- Symptôme : erreur Postgres "infinite recursion detected in policy for
-- relation 'profiles'" sur toute requête client utilisant les RLS.
--
-- Workaround actuel (à conserver pour rétrocompat) : /api/profile/complete
-- utilise service_role pour bypasser RLS.
--
-- ── Fix canonique Supabase ──────────────────────────────────────────────
--
-- Extraire le check de rôle dans une fonction `SECURITY DEFINER`. Cette
-- fonction s'exécute avec les droits du propriétaire de la fonction
-- (postgres) → bypass RLS automatiquement à l'intérieur de la fonction.
-- Postgres ne re-déclenche pas la policy pendant l'évaluation de la fonction.
--
-- Référence : https://supabase.com/docs/guides/auth/row-level-security
--   #policies-with-functions
-- ──────────────────────────────────────────────────────────────────────

-- 1. Fonction SECURITY DEFINER qui check si l'user est ADMIN.
--    SET search_path = public empêche les attaques de search path injection.
--    REVOKE de PUBLIC + GRANT explicite = principe de moindre privilège.
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid AND role = 'ADMIN'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO service_role;

-- 2. Remplacer la policy récursive
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

-- 3. (Vérification) — les 2 autres policies "Users can view/update own"
--    sont déjà non-récursives (auth.uid() = id), on les laisse intactes.
