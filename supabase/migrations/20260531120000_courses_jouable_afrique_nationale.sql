-- Enrichissement LONACI : colonnes autoritaires "jouable Afrique" + Nationale.
-- Nullable + sans defaut -> retro-compatible (NULL = non evalue -> fallback heuristique
-- isJouableAfrique(paris_disponibles)). Voir docs/superpowers/specs/2026-05-31-lonaci-*.
alter table public.courses
  add column if not exists jouable_afrique boolean,
  add column if not exists nationale smallint;

comment on column public.courses.jouable_afrique is
  'Verdict LONACI: NULL=non evalue (fallback heuristique paris_disponibles), true/false=autoritaire';
comment on column public.courses.nationale is
  'Niveau Nationale LONACI (1/2/3), NULL sinon';
