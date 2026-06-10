# Templates WhatsApp Business (WABA) — Séquence de réactivation

> Audit Sprint 1.5, Lot 4 (décision Q4 : canal email + WhatsApp).
> **À soumettre dans Meta WhatsApp Manager** (Business Manager → WhatsApp → Message templates).
> ⚠️ **Aucun appel API dans ce sprint** — ce document prépare la soumission ; l'envoi
> (via `lib/whatsapp/client.ts → sendTemplate()`) est une décision humaine ultérieure.

## Paramètres communs
- **Langue** : `fr`
- **Catégorie** : `MARKETING` (réactivation = marketing au sens Meta ; ne pas tenter UTILITY, rejet quasi sûr)
- Variables : `{{1}}` = prénom. Boutons URL = liens fixes (Meta n'autorise qu'un suffixe dynamique).
- Opt-out : le bouton « Stop » pointe vers `https://elite-turf.fr/stop?t={{2}}` (`{{2}}` = `sms_unsub_token` du profil) — cohérent avec le canal SMS/email.

---

## Template 1 — `reactivation_valeur` (J0 · valeur pure)

**Corps :**
```
Bonjour {{1}} 👋

Saviez-vous que NOTRE SELECTION est gratuite, chaque matin, sur toutes les courses du programme ?

Une lecture statistique claire pour structurer vos paris — sans engagement, sans carte.

Et nos resultats sont publics : victoires comme defaites.
```
**Boutons (URL)** :
1. « Voir la sélection » → `https://elite-turf.fr/courses`
2. « Nos résultats » → `https://elite-turf.fr/performances`

---

## Template 2 — `reactivation_preuve` (J+3 · preuve)

**Corps :**
```
{{1}}, le bilan transparent d'Elite Turf :

✅ {{2}} pronostics gagnants sur les 14 derniers jours — historique complet verifiable en ligne, horodate avant chaque course.

Pas de promesses. Des chiffres publics.
```
*(`{{2}}` = nombre réel de gagnants — fourni à l'envoi via `getHomeStats().gagnantsRecents` ; **ne pas envoyer si 0**.)*

**Bouton (URL)** : « Vérifier l'historique » → `https://elite-turf.fr/performances`

---

## Template 3 — `reactivation_essai` (J+7 · essai Starter)

**Corps :**
```
{{1}}, pret a passer a l'analyse experte ?

Pack Starter : 7 jours, 65 EUR, sans engagement ni reconduction.

🎁 Notre garantie : si votre premier pronostic expert est perdant, 7 jours offerts en plus.

Le jeu comporte des risques — jouez responsable.
```
**Boutons (URL)** :
1. « Découvrir le Pack Starter » → `https://elite-turf.fr/abonnements`

---

## Procédure d'envoi (plus tard, hors sprint)
1. Soumettre les 3 templates dans Meta WhatsApp Manager → attendre l'approbation (24-48h).
2. Générer la liste : `npx tsx scripts/export-reactivation-list.ts --csv` (colonne `sms_eligible=oui` = consentement OK).
3. Envoyer **manuellement** via `sendTemplate()` (`lib/whatsapp/client.ts`) — jamais en masse d'un coup : étaler (rate + réputation du numéro WABA).
4. Respecter immédiatement tout opt-out (`/stop`, réponse « stop » entrante via le webhook WhatsApp existant).
