-- ============================================================
-- SEED ELITE TURF — Données initiales réalistes
-- Hippodromes PMU français + Courses + Pronostics
-- À exécuter dans Supabase → SQL Editor
-- ============================================================

-- ── 1. HIPPODROMES ──────────────────────────────────────────
INSERT INTO hippodromes (nom, ville, pays, actif) VALUES
  ('Vincennes',   'Paris',     'France', true),
  ('Longchamp',   'Paris',     'France', true),
  ('Chantilly',   'Chantilly', 'France', true),
  ('Deauville',   'Deauville', 'France', true),
  ('Saint-Cloud', 'Saint-Cloud','France', true),
  ('Auteuil',     'Paris',     'France', true)
ON CONFLICT (nom) DO NOTHING;

-- ── 2. COURSES (programme PMU réaliste) ─────────────────────
-- On référence les hippodromes par nom via sous-requête

INSERT INTO courses (
  libelle, hippodrome_id, date_course, heure_depart,
  distance_metres, categorie, terrain, nb_partants, publie
) VALUES

-- Vincennes — Trot
(
  'Prix de la Marne — Quinté+ Vincennes',
  (SELECT id FROM hippodromes WHERE nom = 'Vincennes'),
  CURRENT_DATE, '13:50', 2700, 'TROT', 'Piste en ligne', 18, true
),
(
  'Prix de la Jonchere — Trot Attelé',
  (SELECT id FROM hippodromes WHERE nom = 'Vincennes'),
  CURRENT_DATE, '14:50', 2175, 'TROT', 'Piste en ligne', 14, true
),

-- Longchamp — Plat
(
  'Prix du Cadran — Tiercé Longchamp',
  (SELECT id FROM hippodromes WHERE nom = 'Longchamp'),
  CURRENT_DATE, '15:10', 4000, 'PLAT', 'Gazon', 12, true
),
(
  'Prix Vermeille — Quarté+ Longchamp',
  (SELECT id FROM hippodromes WHERE nom = 'Longchamp'),
  CURRENT_DATE, '16:00', 2400, 'PLAT', 'Gazon', 16, true
),

-- Chantilly — Plat
(
  'Prix de Diane — Classique Chantilly',
  (SELECT id FROM hippodromes WHERE nom = 'Chantilly'),
  CURRENT_DATE + 1, '15:30', 2100, 'PLAT', 'Gazon', 15, true
),

-- Auteuil — Obstacle
(
  'Prix La Haye Jousselin — Haies Auteuil',
  (SELECT id FROM hippodromes WHERE nom = 'Auteuil'),
  CURRENT_DATE + 1, '14:15', 4800, 'OBSTACLE', 'Gazon', 10, true
),

-- Deauville
(
  'Prix Jacques Le Marois — Plat Deauville',
  (SELECT id FROM hippodromes WHERE nom = 'Deauville'),
  CURRENT_DATE + 2, '15:45', 1600, 'PLAT', 'Gazon', 13, true
),

-- Saint-Cloud
(
  'Prix Ganay — Plat Saint-Cloud',
  (SELECT id FROM hippodromes WHERE nom = 'Saint-Cloud'),
  CURRENT_DATE + 2, '14:00', 2100, 'PLAT', 'Gazon', 11, true
);

-- ── 3. PRONOSTICS ────────────────────────────────────────────
-- Note : remplacez les course_id par les vrais UUIDs après insert des courses
-- Syntaxe : on utilise une sous-requête pour récupérer le bon course_id

INSERT INTO pronostics (
  course_id, niveau_acces, type_pari, selection,
  confiance, analyse_courte, analyse_texte,
  publie, date_publication, resultat, nb_vues, nb_likes
)
SELECT
  c.id,
  'GRATUIT',
  'QUINTE_PLUS',
  ARRAY[3, 7, 11, 4, 9]::integer[],
  'TRES_ELEVE',
  'Le 3 en grande forme après sa victoire à Enghien. Tiercé en ordre conseillé : 3-7-11.',
  'Notre analyse du Quinté+ du jour pointe vers le 3 (Idéal d''Or), en grande régularité depuis 3 sorties. Le 7 (Magic Trot) monte en puissance avec un entraîneur en pleine série. Le 11 (Belle Époque) ne doit pas être négligé sur cette distance de 2700m.

Conditions de piste : légèrement humide, avantage aux trotteurs réguliers. Déconseillons le 1 en raison d''un tirage défavorable en case 1. Mise conseillée : 2€ ordre + 1€ désordre.',
  true,
  NOW() - INTERVAL '2 hours',
  'EN_ATTENTE',
  847,
  23
FROM courses c
JOIN hippodromes h ON c.hippodrome_id = h.id
WHERE h.nom = 'Vincennes' AND c.libelle LIKE '%Quinté%'
LIMIT 1;

INSERT INTO pronostics (
  course_id, niveau_acces, type_pari, selection,
  confiance, analyse_courte, analyse_texte,
  publie, date_publication, resultat, nb_vues, nb_likes
)
SELECT
  c.id,
  'PREMIUM',
  'TIERCE',
  ARRAY[5, 2, 8]::integer[],
  'ELEVE',
  'Tiercé solide : 5 en tête, 2 et 8 à suivre. Course ouverte mais notre favori mérite confiance.',
  'Analyse premium — Prix du Cadran (4000m Longchamp) :

Le 5 (Lord Windsor) a remporté ses deux dernières sur cette distance, entraîneur Pascal en grande série (+5 victoires ce mois). Le 2 (Fleur de Seine) revient d''une pause de 3 semaines, facteur positif sur Longchamp. Le 8 (Cap Vert) représente la valeur surprise, à intégrer en couverture.

Attention aux 4 et 6 qui peuvent créer la surprise mais sont risqués en base. Mise conseillée abonnés : 3€ en ordre sur 5-2-8.',
  true,
  NOW() - INTERVAL '1 hour',
  'EN_ATTENTE',
  312,
  18
FROM courses c
JOIN hippodromes h ON c.hippodrome_id = h.id
WHERE h.nom = 'Longchamp' AND c.libelle LIKE '%Tiercé%'
LIMIT 1;

INSERT INTO pronostics (
  course_id, niveau_acces, type_pari, selection,
  confiance, analyse_courte, analyse_texte,
  publie, date_publication, resultat, nb_vues, nb_likes
)
SELECT
  c.id,
  'PREMIUM',
  'QUARTE',
  ARRAY[1, 6, 10, 3]::integer[],
  'ELEVE',
  'Quarté+ prometteur sur Longchamp : base sur le 1, excellent jockey. 6-10-3 en combiné.',
  'Prix Vermeille (2400m Gazon) — Analyse Quarté+ :

Le 1 (Élysées Palace) : 3 victoires consécutives sur Gazon, en pleine forme. Jockey Peslier, le meilleur sur Longchamp ce mois.
Le 6 (Sweet Valencia) : montée en puissance progressive, écuries Fabre toujours redoutables.
Le 10 (Marquise de Sévigné) : outsider solide, excellente forme physique selon le paddock.
Le 3 (Belle du Bois) : attention, revient d''une blessure légère mais peut créer la surprise.

Notre sélection en couverture maximale recommandée.',
  true,
  NOW() - INTERVAL '30 minutes',
  'EN_ATTENTE',
  198,
  12
FROM courses c
JOIN hippodromes h ON c.hippodrome_id = h.id
WHERE h.nom = 'Longchamp' AND c.libelle LIKE '%Quarté%'
LIMIT 1;

INSERT INTO pronostics (
  course_id, niveau_acces, type_pari, selection,
  confiance, analyse_courte, analyse_texte,
  publie, date_publication, resultat, nb_vues, nb_likes
)
SELECT
  c.id,
  'GRATUIT',
  'TIERCE',
  ARRAY[4, 9, 2]::integer[],
  'MOYEN',
  'Tiercé Vincennes : 4-9-2, course de trot ouverte. Légère préférence pour le 4 en raison de sa récente victoire.',
  'Analyse gratuite — Trot Attelé Vincennes (2175m) :

Course ouverte à plusieurs candidats. Notre sélection de base : 4-9-2 dans l''ordre conseillé. Le 4 vient de gagner à Enghien il y a 10 jours, reprend sur cette distance qu''il apprécie. Attention au 9, outsider sérieux à inclure.',
  true,
  NOW() - INTERVAL '3 hours',
  'GAGNANT',
  1203,
  45
FROM courses c
JOIN hippodromes h ON c.hippodrome_id = h.id
WHERE h.nom = 'Vincennes' AND c.libelle LIKE '%Trot%'
LIMIT 1;

INSERT INTO pronostics (
  course_id, niveau_acces, type_pari, selection,
  confiance, analyse_courte, analyse_texte,
  publie, date_publication, resultat, nb_vues, nb_likes
)
SELECT
  c.id,
  'VIP',
  'QUINTE_PLUS',
  ARRAY[7, 3, 12, 5, 1]::integer[],
  'TRES_ELEVE',
  '[VIP] Analyse exclusive Chantilly : notre algorithme pointe le 7 avec 89% de confiance. Quinté en ordre.',
  'ANALYSE VIP EXCLUSIVE — Prix de Diane Chantilly (2100m) :

🔒 Rapport complet algorithmique :

Le 7 (Étoile de Paris) : score algorithmique 89/100. Données de forme sur 12 dernières sorties analysées. Entraîneur en série de 7 victoires sur Chantilly cette saison. Jockey Soumillon — le meilleur coefficient de placement sur cette piste.

Le 3 (Versailles Rose) : score 82/100. Excellente sur Gazon, distance idéale.
Le 12 (Châtelaine) : surprise algorithmique. Forme physique en hausse selon données paddock.
Le 5 (Dame de Cœur) : régularité exemplaire. 4/5 dernières en top 3.
Le 1 (Princesse Royale) : outsider de luxe. Cote élevée = valeur.

Mise VIP recommandée : Quinté en ordre sur 7-3-12-5-1 (3€) + désordre sur 5 chevaux (2€).',
  true,
  NOW() - INTERVAL '15 minutes',
  'EN_ATTENTE',
  87,
  31
FROM courses c
JOIN hippodromes h ON c.hippodrome_id = h.id
WHERE h.nom = 'Chantilly'
LIMIT 1;

-- ── 4. CONFIRMATION ─────────────────────────────────────────
SELECT
  'SEED TERMINÉ' as status,
  (SELECT COUNT(*) FROM hippodromes) as hippodromes,
  (SELECT COUNT(*) FROM courses) as courses,
  (SELECT COUNT(*) FROM pronostics) as pronostics;
