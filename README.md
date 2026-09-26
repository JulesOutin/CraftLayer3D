# Boutique d'impression 3D — Next.js + Supabase + Stripe

MVP complet : catalogue, panier, paiement Stripe, commandes enregistrées automatiquement,
back-office (tableau de bord, suivi des commandes, import CSV, calcul des prix).

## Ce que contient le projet

| Chemin | Rôle |
|---|---|
| `supabase/schema.sql` | Tables, sécurité RLS, bucket d'images, matières de départ |
| `src/app/(shop)` | Boutique : accueil, fiche produit, panier, confirmation |
| `src/app/api/checkout` | Crée la session de paiement Stripe (prix relus en base) |
| `src/app/api/stripe/webhook` | Enregistre la commande quand le paiement est confirmé |
| `src/app/admin` | Back-office protégé |
| `src/lib/pricing.ts` | La formule de prix, à ajuster selon ton atelier |
| `src/lib/email.ts` | E-mails transactionnels (confirmation, suivi de commande) via Resend |
| `public/modele-import.csv` | Modèle d'import téléchargeable depuis l'admin |

## 1. Supabase

1. Crée un projet sur supabase.com, région **Europe (Paris ou Francfort)**.
2. **SQL Editor** : colle le contenu de `supabase/schema.sql` et exécute-le.
3. **Authentication > Users > Add user** : crée ton compte admin (e-mail + mot de passe).
4. Dans le SQL Editor, donne-lui le rôle admin (porté par son JWT Supabase Auth) :
   ```sql
   update auth.users
   set raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
   where email = 'toi@exemple.fr';
   ```
   Reconnecte-toi ensuite pour que le nouveau JWT contienne le rôle.
5. **Authentication > Sign In / Providers** : désactive « Allow new users to sign up ».
   Seul ton compte doit exister (le rôle `admin` protège de toute façon l'accès).
6. **Project Settings > API** : récupère l'URL, la clé publique (anon / publishable)
   et la clé secrète (service_role / secret).

Le RLS est activé sur toutes les tables : le public ne peut lire que le catalogue actif,
les commandes ne sont visibles que par les admins.

## 2. Stripe

1. Crée un compte sur stripe.com et reste en **mode test** pendant le développement.
2. **Developers > API keys** : copie la clé secrète `sk_test_...`.
3. Le webhook est configuré à l'étape 4 (local) ou 5 (production).

## 3. Lancer en local

```bash
cp .env.example .env.local   # puis remplis les valeurs
npm install
npm run dev
```

Pour recevoir les webhooks en local, installe la Stripe CLI puis :

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

La commande affiche un `whsec_...` à mettre dans `STRIPE_WEBHOOK_SECRET`.
Carte de test : `4242 4242 4242 4242`, date future, n'importe quel CVC.

## 4. Premier catalogue

1. Va sur `/admin`, connecte-toi.
2. **Prix et matières** : règle tes coûts (tarif machine, marge, TVA…) et tes matières.
   Le simulateur te montre le prix obtenu à partir du poids et du temps de ton slicer.
3. **Import CSV** : télécharge le modèle, remplis-le, importe-le.
4. Images : dépose-les dans **Storage > product-images** sur Supabase, copie l'URL publique
   dans la colonne `image_url` du CSV, puis réimporte (les SKU existants sont mis à jour).

### Format du CSV

| Colonne | Obligatoire | Exemple |
|---|---|---|
| slug | oui | `vase-spirale` (regroupe les déclinaisons d'un même produit) |
| titre | oui | Vase spirale |
| description | non | Texte libre (lue sur la première ligne du slug) |
| image_url | non | URL publique https |
| sku | oui | `VASE-SP-PLA-NOIR` (identifiant unique de la déclinaison) |
| declinaison | oui | PLA noir |
| matiere | oui | Doit exister dans Prix et matières |
| grammes | oui | 85 |
| minutes_impression | oui | 210 |
| minutes_finition | non | 5 |
| prix_force | non | 6.90 (remplace le prix calculé) |
| actif | non | `non` pour masquer la déclinaison |
| stock | non | Quantité disponible ; vide = stock non suivi (toujours en vente) |

Si une seule ligne est invalide, rien n'est importé et la liste des erreurs s'affiche.

Le catalogue public (`/`) propose une recherche par nom et des filtres par matière et
par prix. Quand le stock d'une déclinaison tombe à 0, elle affiche « Rupture de stock »
et ne peut plus être ajoutée au panier ; le paiement est aussi bloqué côté serveur si le
stock a changé entre-temps. Modifie le stock d'une déclinaison depuis **Produits**, ou
lors d'un import CSV.

## 5. E-mails transactionnels (Resend)

1. Crée un compte sur resend.com (gratuit jusqu'à 3 000 e-mails/mois).
2. **API Keys > Create API Key**, copie-la dans `RESEND_API_KEY`.
3. Pour un envoi depuis ton propre nom de domaine : **Domains > Add Domain**, ajoute les
   enregistrements DNS demandés, puis mets `RESEND_FROM_EMAIL=contact@ton-domaine.fr`.
   Sans domaine, `onboarding@resend.dev` fonctionne pour tester mais n'envoie qu'à
   l'adresse e-mail de ton compte Resend.
4. Laisser `RESEND_API_KEY` vide désactive l'envoi : les e-mails sont simplement
   journalisés dans les logs serveur, pratique en développement.

Un e-mail de confirmation part automatiquement quand une commande est payée
(webhook Stripe), et un e-mail de suivi part quand tu changes son statut ou son
numéro de suivi depuis **Commandes**.

## 6. Mise en ligne sur Vercel

1. Pousse le projet sur GitHub (le `.env.local` est ignoré par git).
2. Sur vercel.com : **Add New > Project**, importe le dépôt. Next.js est détecté tout seul.
3. **Environment Variables** : ajoute les variables de `.env.example`,
   avec `NEXT_PUBLIC_SITE_URL` = ton URL Vercel ou ton domaine.
4. Déploie.
5. Sur Stripe, **Developers > Webhooks > Add endpoint** :
   - URL : `https://ton-domaine.fr/api/stripe/webhook`
   - Événement : `checkout.session.completed`
   - Copie le secret de signature dans `STRIPE_WEBHOOK_SECRET` sur Vercel, puis redéploie.
6. Passe une commande test de bout en bout, vérifie qu'elle apparaît dans `/admin/commandes`.
7. Quand tout fonctionne : active ton compte Stripe, remplace les clés test par les clés live
   (et crée le webhook en mode live).

## Formule de prix

```
matière   = grammes / 1000 × prix au kg
machine   = heures d'impression × tarif machine
échecs    = (matière + machine) × taux d'échec
finition  = minutes de finition / 60 × tarif horaire
coût      = matière + machine + échecs + finition + emballage
prix TTC  = coût × coefficient de marge × (1 + TVA), arrondi au pas supérieur, prix plancher
```

Modifier un réglage ou une matière recalcule tout le catalogue (sauf les prix forcés).

## Avant d'ouvrir au public

- Pages légales à ajouter : mentions légales, CGV, politique de confidentialité.
  Le droit de rétractation de 14 jours s'applique aux produits du catalogue.
- Personnalise `src/lib/config.ts` (nom, délai, e-mail, pays de livraison).
- Active les reçus e-mail automatiques dans Stripe (Settings > Customer emails).
- Passe Supabase en plan payant : les projets gratuits sont mis en pause après une période d'inactivité.

## Pistes pour la suite

- Édition des produits directement dans l'admin, upload d'images depuis l'admin.
- Devis sur fichier STL envoyé par le client.
- Export comptable CSV des ventes.
- Alerte admin (e-mail ou tableau de bord) quand une déclinaison passe sous un seuil de stock.
