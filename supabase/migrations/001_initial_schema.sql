-- =============================================
-- ELITE TURF — Schéma Base de Données Initial
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TABLE: profiles (extends Supabase auth.users)
-- =============================================
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    nom_complet TEXT,
    phone TEXT,
    pays TEXT DEFAULT 'Côte d''Ivoire',
    ville TEXT,
    operateur_mobile TEXT CHECK (operateur_mobile IN ('ORANGE_CI','MTN','WAVE','AUTRE')),
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER','ADMIN','MODERATEUR')),
    statut_abonnement TEXT NOT NULL DEFAULT 'GRATUIT' CHECK (statut_abonnement IN ('GRATUIT','PREMIUM','VIP','EXPIRE')),
    source_acquisition TEXT,
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    date_inscription TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    derniere_connexion TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- TABLE: hippodromes
-- =============================================
CREATE TABLE public.hippodromes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nom TEXT NOT NULL,
    pays TEXT NOT NULL DEFAULT 'France',
    ville TEXT NOT NULL,
    fuseau_horaire TEXT NOT NULL DEFAULT 'Europe/Paris',
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed hippodromes principaux
INSERT INTO public.hippodromes (nom, pays, ville, fuseau_horaire) VALUES
    ('Longchamp', 'France', 'Paris', 'Europe/Paris'),
    ('Vincennes', 'France', 'Paris', 'Europe/Paris'),
    ('Chantilly', 'France', 'Chantilly', 'Europe/Paris'),
    ('Auteuil', 'France', 'Paris', 'Europe/Paris'),
    ('Deauville', 'France', 'Deauville', 'Europe/Paris'),
    ('Cagnes-sur-Mer', 'France', 'Cagnes-sur-Mer', 'Europe/Paris'),
    ('Lyon-La Soie', 'France', 'Lyon', 'Europe/Paris'),
    ('Hippodrome de la Riviera', 'Côte d''Ivoire', 'Abidjan', 'Africa/Abidjan'),
    ('Hippodrome de Dakar', 'Sénégal', 'Dakar', 'Africa/Dakar');

-- =============================================
-- TABLE: courses
-- =============================================
CREATE TABLE public.courses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    hippodrome_id UUID REFERENCES public.hippodromes(id) NOT NULL,
    date_course DATE NOT NULL,
    heure_depart TIME NOT NULL,
    numero_reunion INTEGER NOT NULL,
    numero_course INTEGER NOT NULL,
    libelle TEXT NOT NULL,
    distance_metres INTEGER NOT NULL,
    categorie TEXT NOT NULL DEFAULT 'PLAT' CHECK (categorie IN ('PLAT','TROT','OBSTACLE')),
    condition TEXT,
    terrain TEXT CHECK (terrain IN ('BON','BON_SOUPLE','SOUPLE','LOURD','TRES_LOURD')),
    nb_partants INTEGER NOT NULL DEFAULT 0,
    statut TEXT NOT NULL DEFAULT 'PROGRAMME' CHECK (statut IN ('PROGRAMME','EN_COURS','TERMINE','ANNULE')),
    arrivee_officielle INTEGER[],
    source_import TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(hippodrome_id, date_course, numero_reunion, numero_course)
);

-- =============================================
-- TABLE: jockeys
-- =============================================
CREATE TABLE public.jockeys (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nom_complet TEXT NOT NULL,
    nationalite TEXT,
    nb_victoires_saison INTEGER DEFAULT 0,
    taux_victoire_pct DECIMAL(5,2) DEFAULT 0,
    photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- TABLE: entraineurs
-- =============================================
CREATE TABLE public.entraineurs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nom_complet TEXT NOT NULL,
    nationalite TEXT,
    nb_victoires_saison INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- TABLE: chevaux
-- =============================================
CREATE TABLE public.chevaux (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nom TEXT NOT NULL,
    age INTEGER,
    sexe TEXT CHECK (sexe IN ('MALE','FEMELLE','HONGRE')),
    robe TEXT,
    nationalite TEXT,
    entraineur_id UUID REFERENCES public.entraineurs(id),
    proprietaire TEXT,
    gains_totaux_eur INTEGER DEFAULT 0,
    nb_victoires INTEGER DEFAULT 0,
    nb_courses INTEGER DEFAULT 0,
    derniere_perf JSONB,
    photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- TABLE: partants (course x cheval)
-- =============================================
CREATE TABLE public.partants (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    cheval_id UUID REFERENCES public.chevaux(id) NOT NULL,
    jockey_id UUID REFERENCES public.jockeys(id),
    numero_partant INTEGER NOT NULL,
    cote_depart DECIMAL(8,2),
    cote_derniere DECIMAL(8,2),
    poids_kg DECIMAL(4,1),
    position_depart INTEGER,
    classement_final INTEGER,
    temps_course TEXT,
    non_partant BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(course_id, numero_partant)
);

-- =============================================
-- TABLE: plans
-- =============================================
CREATE TABLE public.plans (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nom TEXT NOT NULL CHECK (nom IN ('Starter','Pro','Elite')),
    prix_fcfa INTEGER NOT NULL,
    prix_eur DECIMAL(8,2) NOT NULL,
    duree_jours INTEGER NOT NULL DEFAULT 30,
    acces_premium BOOLEAN NOT NULL DEFAULT FALSE,
    acces_vip BOOLEAN NOT NULL DEFAULT FALSE,
    nb_alertes INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    features JSONB NOT NULL DEFAULT '[]',
    populaire BOOLEAN NOT NULL DEFAULT FALSE,
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed plans
INSERT INTO public.plans (nom, prix_fcfa, prix_eur, duree_jours, acces_premium, acces_vip, nb_alertes, description, features, populaire) VALUES
(
    'Starter', 5000, 7.50, 30, TRUE, FALSE, 5,
    'Pour débuter avec les meilleurs pronostics',
    '["3 pronostics Tiercé/semaine","Analyse courte incluse","5 alertes SMS/Push par mois","Statistiques basiques"]'::jsonb,
    FALSE
),
(
    'Pro', 15000, 23.00, 30, TRUE, FALSE, 20,
    'Le choix des turfistes sérieux',
    '["Pronostics illimités (Tiercé, Quarté+)","Analyse complète d''expert","20 alertes SMS/Push par mois","Statistiques complètes","Support WhatsApp 48h"]'::jsonb,
    TRUE
),
(
    'Elite', 35000, 53.00, 30, TRUE, TRUE, -1,
    'L''accès total pour les experts',
    '["Tout Pro inclus","Pronostics VIP exclusifs","Alertes illimitées","Export statistiques","Support WhatsApp prioritaire","Accès replays & analyses vidéo"]'::jsonb,
    FALSE
);

-- =============================================
-- TABLE: abonnements
-- =============================================
CREATE TABLE public.abonnements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    plan_id UUID REFERENCES public.plans(id) NOT NULL,
    date_debut DATE NOT NULL DEFAULT CURRENT_DATE,
    date_fin DATE NOT NULL,
    statut TEXT NOT NULL DEFAULT 'ACTIF' CHECK (statut IN ('ACTIF','EXPIRE','SUSPENDU','OFFERT')),
    auto_renouvellement BOOLEAN NOT NULL DEFAULT FALSE,
    transaction_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- TABLE: transactions
-- =============================================
CREATE TABLE public.transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    abonnement_id UUID REFERENCES public.abonnements(id),
    montant_fcfa INTEGER NOT NULL,
    montant_devise DECIMAL(10,2),
    devise TEXT NOT NULL DEFAULT 'XOF',
    methode TEXT NOT NULL CHECK (methode IN ('ORANGE_MONEY','MTN_MOMO','WAVE','STRIPE','PAYPAL')),
    reference_operateur TEXT,
    statut TEXT NOT NULL DEFAULT 'EN_ATTENTE' CHECK (statut IN ('EN_ATTENTE','SUCCES','ECHEC','REMBOURSE')),
    ip_utilisateur TEXT,
    metadata JSONB,
    date_transaction TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- TABLE: pronostics
-- =============================================
CREATE TABLE public.pronostics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    auteur_id UUID REFERENCES public.profiles(id) NOT NULL,
    niveau_acces TEXT NOT NULL DEFAULT 'GRATUIT' CHECK (niveau_acces IN ('GRATUIT','PREMIUM','VIP')),
    type_pari TEXT NOT NULL CHECK (type_pari IN ('SIMPLE','COUPLE','TRIO','TIERCE','QUARTE','QUINTE_PLUS')),
    selection INTEGER[] NOT NULL,
    confiance TEXT NOT NULL CHECK (confiance IN ('FAIBLE','MOYEN','ELEVE','TRES_ELEVE')),
    analyse_texte TEXT,
    analyse_courte TEXT NOT NULL,
    publie BOOLEAN NOT NULL DEFAULT FALSE,
    date_publication TIMESTAMPTZ,
    resultat TEXT NOT NULL DEFAULT 'EN_ATTENTE' CHECK (resultat IN ('GAGNANT','PERDANT','PARTIEL','EN_ATTENTE')),
    gains_theoriques DECIMAL(10,2),
    nb_vues INTEGER NOT NULL DEFAULT 0,
    nb_likes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- TABLE: notifications
-- =============================================
CREATE TABLE public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    titre TEXT NOT NULL,
    message TEXT NOT NULL,
    canal TEXT NOT NULL CHECK (canal IN ('PUSH','EMAIL','SMS','WHATSAPP')),
    statut TEXT NOT NULL DEFAULT 'EN_ATTENTE' CHECK (statut IN ('EN_ATTENTE','ENVOYE','ECHEC')),
    onesignal_id TEXT,
    date_envoi TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- FONCTIONS & TRIGGERS
-- =============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, nom_complet, phone, pays)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'nom_complet',
        NEW.raw_user_meta_data->>'phone',
        COALESCE(NEW.raw_user_meta_data->>'pays', 'Côte d''Ivoire')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_courses_updated_at BEFORE UPDATE ON public.courses
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_pronostics_updated_at BEFORE UPDATE ON public.pronostics
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_abonnements_updated_at BEFORE UPDATE ON public.abonnements
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hippodromes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chevaux ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jockeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entraineurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abonnements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pronostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles: users see only their own, admins see all
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- Hippodromes: public read
CREATE POLICY "Hippodromes are public" ON public.hippodromes
    FOR SELECT USING (TRUE);

CREATE POLICY "Admins manage hippodromes" ON public.hippodromes
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- Courses: public read
CREATE POLICY "Courses are public" ON public.courses
    FOR SELECT USING (TRUE);

CREATE POLICY "Admins manage courses" ON public.courses
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- Chevaux, Jockeys, Entraineurs, Partants: public read
CREATE POLICY "Chevaux public read" ON public.chevaux FOR SELECT USING (TRUE);
CREATE POLICY "Jockeys public read" ON public.jockeys FOR SELECT USING (TRUE);
CREATE POLICY "Entraineurs public read" ON public.entraineurs FOR SELECT USING (TRUE);
CREATE POLICY "Partants public read" ON public.partants FOR SELECT USING (TRUE);

CREATE POLICY "Admins manage chevaux" ON public.chevaux FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));
CREATE POLICY "Admins manage jockeys" ON public.jockeys FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));
CREATE POLICY "Admins manage entraineurs" ON public.entraineurs FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));
CREATE POLICY "Admins manage partants" ON public.partants FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- Plans: public read
CREATE POLICY "Plans are public" ON public.plans FOR SELECT USING (TRUE);

-- Pronostics: complex access control
CREATE POLICY "Free pronostics are public" ON public.pronostics
    FOR SELECT USING (
        publie = TRUE AND niveau_acces = 'GRATUIT'
    );

CREATE POLICY "Premium pronostics for subscribers" ON public.pronostics
    FOR SELECT USING (
        publie = TRUE AND (
            niveau_acces = 'GRATUIT'
            OR (
                niveau_acces = 'PREMIUM' AND EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE id = auth.uid()
                    AND statut_abonnement IN ('PREMIUM','VIP')
                )
            )
            OR (
                niveau_acces = 'VIP' AND EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE id = auth.uid()
                    AND statut_abonnement = 'VIP'
                )
            )
        )
    );

CREATE POLICY "Admins manage pronostics" ON public.pronostics
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- Abonnements: users see own
CREATE POLICY "Users see own subscriptions" ON public.abonnements
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins manage subscriptions" ON public.abonnements
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- Transactions: users see own
CREATE POLICY "Users see own transactions" ON public.transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins manage transactions" ON public.transactions
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- Notifications: users see own
CREATE POLICY "Users see own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- =============================================
-- INDEXES pour performance
-- =============================================
CREATE INDEX idx_courses_date ON public.courses(date_course DESC);
CREATE INDEX idx_courses_statut ON public.courses(statut);
CREATE INDEX idx_pronostics_course ON public.pronostics(course_id);
CREATE INDEX idx_pronostics_niveau ON public.pronostics(niveau_acces, publie);
CREATE INDEX idx_partants_course ON public.partants(course_id);
CREATE INDEX idx_abonnements_user ON public.abonnements(user_id);
CREATE INDEX idx_abonnements_statut ON public.abonnements(statut, date_fin);
CREATE INDEX idx_transactions_user ON public.transactions(user_id);
