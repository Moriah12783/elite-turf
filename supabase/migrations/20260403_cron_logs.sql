-- Table de logs pour les cron jobs Elite Turf
-- Permet de monitorer les succès/échecs depuis l'admin dashboard

CREATE TABLE IF NOT EXISTS public.cron_logs (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cron_name    text NOT NULL,
  status       text NOT NULL CHECK (status IN ('success', 'failure', 'skip')),
  details      jsonb,
  duration_ms  integer,
  executed_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cron_logs_name_date
  ON public.cron_logs (cron_name, executed_at DESC);

-- Nettoyage automatique : garder seulement les 7 derniers jours
CREATE OR REPLACE FUNCTION public.cleanup_cron_logs()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM public.cron_logs WHERE executed_at < now() - interval '7 days';
$$;

-- Appliquer le nettoyage à chaque insert
CREATE OR REPLACE FUNCTION public.trigger_cleanup_cron_logs()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.cleanup_cron_logs();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_cron_logs ON public.cron_logs;
CREATE TRIGGER trg_cleanup_cron_logs
  AFTER INSERT ON public.cron_logs
  FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_cleanup_cron_logs();

-- RLS : seul le service role peut accéder
ALTER TABLE public.cron_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_only" ON public.cron_logs
  USING (auth.role() = 'service_role');
