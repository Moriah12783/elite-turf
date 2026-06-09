-- ============================================================================
-- 20260609_fix_handle_new_user_phone.sql
--
-- BUG : une version antérieure de handle_new_user() avait perdu la colonne
-- `phone` dans son INSERT. Résultat : depuis ce changement, TOUS les nouveaux
-- inscrits perdaient leur numéro (présent dans la metadata auth mais jamais
-- gravé dans profiles.phone) → ~34 % seulement des profils avaient un numéro,
-- et le SMS de bienvenue ne pouvait jamais partir.
--
-- FIX : le trigger réinsère `phone` (+ `sms_opt_in`) depuis raw_user_meta_data.
-- BACKFILL : récupère les numéros perdus encore présents dans la metadata.
-- Idempotent et non destructif (ne touche que les phone NULL/vides).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id, email, nom_complet, phone, pays, role, statut_abonnement, actif,
    date_inscription, sms_opt_in
  ) VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'nom_complet',
    NULLIF(btrim(NEW.raw_user_meta_data->>'phone'), ''),   -- '' / absent → NULL
    NEW.raw_user_meta_data->>'pays',
    'USER',
    'GRATUIT',
    true,
    NOW(),
    COALESCE((NEW.raw_user_meta_data->>'sms_opt_in')::boolean, true)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Backfill : restaure les numéros perdus depuis la metadata auth.users
UPDATE public.profiles p
SET phone = NULLIF(btrim(u.raw_user_meta_data->>'phone'), '')
FROM auth.users u
WHERE p.id = u.id
  AND (p.phone IS NULL OR btrim(p.phone) = '')
  AND NULLIF(btrim(u.raw_user_meta_data->>'phone'), '') IS NOT NULL;
