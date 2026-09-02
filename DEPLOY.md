# Déploiement NexaPay — 0 € (Neon + Vercel × 2)

## Architecture — Vercel Services (un projet, deux services)

Vercel détecte les deux applications du dépôt et les déploie **dans un seul
projet**, sous **une seule URL**. C'est le modèle `services`, configuré par le
[vercel.json](vercel.json) à la racine.

```
GitHub (monorepo)
└── Projet Vercel #1  →  https://nexapay.vercel.app
    ├── service "frontend"  (frontend/)  →  /
    └── service "backend"   (backend/)   →  /api/*
              │
              └── Neon (PostgreSQL)  →  DATABASE_URL

    Projet Vercel #2  →  https://nexapay-admin.vercel.app
    └── Dashboard/  (console d'administration, domaine séparé)
```

| Composant | Où | Coût |
|-----------|-----|------|
| Base de données | [Neon](https://neon.tech) Free | **0 €** |
| API + Frontend | Vercel — projet unique, 2 services | **0 €** |
| Back-office | Vercel — projet séparé | **0 €** |

**Ce que ce modèle apporte :** une seule URL, donc **plus de CORS ni d'URL d'API
en dur** entre le front et l'API. `VITE_API_URL=/api` suffit.

**Deux points à connaître :**

1. Le service reçoit le **chemin d'origine** : `/api/quotes` arrive à Express
   comme `/api/quotes`. Aucun changement de code côté back-end.
2. En mode `services`, les clés `buildCommand`, `installCommand`, `functions` et
   `framework` ne sont **plus valides à la racine** : elles vivent dans chaque
   service. C'est pourquoi `backend/vercel.json` et `frontend/vercel.json` ont
   été fusionnés dans le fichier racine — ne les recréez pas, ils feraient
   doublon.

Le back-office reste un **projet distinct** : une console d'administration sur
son propre domaine réduit la surface exposée, et son cycle de déploiement est
indépendant.

---

## Étape 2 — Créer le projet (frontend + backend)

1. [vercel.com/new](https://vercel.com/new) → importer le dépôt.
2. Vercel détecte les deux services et demande le `vercel.json` racine : il est
   **déjà dans le dépôt**, laissez **Root Directory** à la racine (`./`).
3. Renseigner les variables d'environnement (voir 2.2), puis déployer.

Le build exécute, pour le service `backend` :
`npm install` → `npm run db:deploy` (migrations) → `npm run build` (client Prisma).

---

## Étape 2bis — Backend sur Vercel (ancien modèle, projets séparés)

<details>
<summary>Conservé pour référence — non nécessaire avec le modèle services</summary>

## Étape 2 — Backend sur Vercel (projet séparé)

### 2.1 Créer le 2ᵉ projet

1. [vercel.com/new](https://vercel.com/new) → **même repo GitHub**.
2. Paramètres :

| Champ | Valeur |
|-------|--------|
| **Project name** | `nexapay-api` (exemple) |
| **Root Directory** | `backend` |
| **Framework Preset** | Other |

Vercel lit `backend/vercel.json` (Express en serverless via `api/index.ts`).

### 2.2 Variables d’environnement (projet backend)

Toutes les variables de `backend/.env.example` :

| Variable | Note |
|----------|------|
| `DATABASE_URL` | URL **pooled** Neon |
| `JWT_SECRET` | Secret fort |
| `FRONTEND_URL` | URL du projet frontend (après étape 3), ex. `https://nexapay.vercel.app` |
| `SMTP_*`, `CLOUDINARY_*`, `FEDAPAY_*`, `OPENAI_*` | Comme en local |
| `GOOGLE_CLIENT_ID`, `APPLE_CLIENT_ID` | Idem frontend |

### 2.3 Déployer

1. **Deploy** → URL API : `https://nexapay-api.vercel.app`
2. Tester : `https://nexapay-api.vercel.app/api/health` → `{"status":"ok"}`
3. Base vide : en local `cd backend && npx prisma db push` avec `DATABASE_URL` Neon

### 2.4 Webhook Fedapay

```
https://nexapay-api.vercel.app/api/payments/webhook
```

---

</details>

---

## Étape 3 — Frontend sur Vercel (projet séparé)

### 3.1 Créer le 1ᵉʳ projet (ou importer en premier)

1. [vercel.com/new](https://vercel.com/new) → même repo.

| Champ | Valeur |
|-------|--------|
| **Project name** | `nexapay` |
| **Root Directory** | `frontend` |
| **Framework** | Vite |
| **Output** | `dist` |

### 3.2 Variables (projet frontend)

| Variable | Valeur |
|----------|--------|
| `VITE_API_URL` | `/api` (modèle services) — ou `https://nexapay-api.vercel.app/api` si projets séparés |
| `VITE_GOOGLE_CLIENT_ID` | … |
| `VITE_APPLE_CLIENT_ID` | `com.nexapay.app` |

> `VITE_API_URL` doit finir par `/api`.

### 3.3 Boucler les deux projets

1. Noter l’URL frontend : `https://nexapay.vercel.app`
2. Projet **backend** → `FRONTEND_URL` = cette URL → **Redeploy**
3. Si le frontend était déployé avant l’API, rebuild frontend après `VITE_API_URL` correct

---

## ⚠️ Limites Vercel gratuit (backend serverless)

| Effet | Détail |
|-------|--------|
| **Cold start** | 1ʳᵉ requête après inactivité : quelques secondes (souvent < Render Free qui dort 15 min) |
| **Timeout** | Max **10 s** (Hobby) par requête — la confirmation paiement avec retries peut être limite ; le webhook + redirect `/pay/success` compensent |
| **Pas de WebSocket** | Une fonction serverless ne garde pas de connexion ouverte. Les notifications passent alors par le **polling** du front (30 s), ce qui suffit. Laissez `VITE_WS_URL` vide. |

### Notifications système (Web Push)

Pour que les marchands soient prévenus **application fermée** (paiement reçu,
reversement échoué) :

```bash
npx web-push generate-vapid-keys
```

Puis, sur le projet **backend** : `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et
`VAPID_SUBJECT` (`mailto:…`). Sans ces clés, le push est proprement désactivé —
le front ne propose pas l'option et les notifications restent visibles dans
l'application. L'utilisateur active ensuite le push depuis **Réglages →
Notifications** (la permission navigateur est demandée à ce moment-là, jamais au
chargement).

### Notifications en temps réel (optionnel)

Le serveur WebSocket ne tourne que sur un hôte long-vivant (Render, VPS). Pour
l'activer :

1. Déployer le backend sur Render (voir plus bas).
2. Projet **frontend** → `VITE_WS_URL` = `wss://nexapay-api.onrender.com` → redeploy.

Sans cette variable, aucune socket n'est ouverte et les notifications se
rafraîchissent par polling. Le token JWT est transmis en sous-protocole
WebSocket, jamais dans l'URL.

---

## Base de données — migrations

Le build backend exécute `npm run db:deploy`, qui :

1. refuse le déploiement si une migration contient du SQL destructif
   (`verify-migrations.mjs`) ;
2. applique les migrations en attente, en marquant la baseline comme déjà
   appliquée si la base existait avant Prisma Migrate (erreur `P3005`).

**Ne supprimez jamais `backend/prisma/migrations/`** : sans ce dossier,
`migrate deploy` réussit sans rien créer, et les tables ajoutées depuis
(`Notification`, `ActivityLog`…) manquent en production — les routes
concernées répondent alors 500.

Après un changement de `schema.prisma` :

```bash
npm run db:migrate --workspace=backend -- --name description_du_changement
```

---

## Back-office — projet Vercel séparé

Le dossier `Dashboard/` n'appartient pas aux workspaces npm : il a son propre
`package-lock.json` et se déploie comme un projet indépendant.

1. [vercel.com/new](https://vercel.com/new) → **même dépôt**.

| Champ | Valeur |
|-------|--------|
| **Project name** | `nexapay-admin` |
| **Root Directory** | `Dashboard` |
| **Framework** | Vite |
| **Variable** | `VITE_API_URL=/api` |

2. Dans `Dashboard/vercel.json`, remplacer `REMPLACER-PAR-URL-DU-PROJET` par
   l'URL du projet principal, puis redéployer.

L'accès est réservé aux comptes dont le champ `role` vaut `ADMIN` — le back-end
refuse les autres, et l'interface les renvoie à l'écran de connexion.

## Compte administrateur

Pour créer ou promouvoir ce compte :

```bash
ADMIN_EMAIL="vous@exemple.com" ADMIN_PASSWORD="…" npm run db:seed --workspace=backend
```

Sur un compte déjà existant, le seed accorde seulement le rôle : il ne touche
jamais au mot de passe.

---

## ⚠️ Limites du plan Render gratuit (alternative)

| Effet | Détail |
|-------|--------|
| **Mise en veille** | Après ~15 min sans requête, l’API **s’endort**. |
| **Réveil lent** | La 1ʳᵉ requête peut prendre **30 s à 1 min**. |
| **Webhooks Fedapay** | Peuvent arriver pendant que le serveur dort → parfois **ratés**. |

**Ce qui compense (déjà dans votre code) :** quand le client revient de Fedapay, la page `/pay/success` appelle `confirm-quote` — le paiement peut quand même être validé **sans** webhook.

**Pour plus tard (quand vous avez un budget) :** Render Starter (~7 $/mois) = API toujours active, webhooks fiables.

---

## Étape 0 — Prérequis

- Repo sur GitHub.
- Comptes **Neon**, **Render**, **Vercel** (gratuits).
- Clés dans `backend/.env` : SMTP, Cloudinary, Fedapay, OpenAI, Google, Apple.

JWT secret :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Étape 1 — Neon (gratuit)

1. [console.neon.tech](https://console.neon.tech) → **New Project**.
2. Copier **`DATABASE_URL`** (URL **pooled**, avec `?sslmode=require`).
3. En local :

```bash
cd backend
# DATABASE_URL Neon dans .env
npx prisma db push
```

---

## Étape 2 — Render (gratuit)

### 2.1 Créer le service

1. [dashboard.render.com](https://dashboard.render.com) → **New +** → **Web Service**.
2. Repo GitHub → paramètres :

| Champ | Valeur |
|-------|--------|
| **Name** | `nexapay-api` |
| **Region** | Frankfurt |
| **Root Directory** | `backend` |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Instance type** | **Free** ← pas Starter |

> Blueprint : `render.yaml` à la racine (plan `free`).

### 2.2 Variables d’environnement

Toutes les variables de `backend/.env.example` :

| Variable | Note |
|----------|------|
| `DATABASE_URL` | URL pooled Neon |
| `JWT_SECRET` | Secret fort |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | URL Vercel (après étape 3), sans `/` final |
| `SMTP_*`, `CLOUDINARY_*`, `FEDAPAY_*`, `OPENAI_*` | Comme en local |
| `GOOGLE_CLIENT_ID`, `APPLE_CLIENT_ID` | Idem frontend |

Ne pas définir `PORT` (injecté par Render).

### 2.3 Déployer

1. **Create Web Service** → build vert.
2. Tester (1ʳᵉ requête peut être lente si le service dormait) :  
   `https://nexapay-api.onrender.com/api/health` → `{"status":"ok"}`
3. Base vide → Shell Render : `npx prisma db push`

### 2.4 Fedapay webhook

```
https://nexapay-api.onrender.com/api/payments/webhook
```

Sur le plan gratuit, gardez aussi le flux **redirect + confirm-quote** (page succès) comme filet de sécurité.

### 2.5 (Optionnel) Réduire la mise en veille — 0 €

[UptimeRobot](https://uptimerobot.com) gratuit : ping `/api/health` **toutes les 14 minutes** (Render dort vers 15 min).

- Ce n’est pas une garantie à 100 %.
- Suffisant pour **tests / premiers utilisateurs**.
- Pas idéal pour forte charge paiements en prod.

---

## Étape 3 — Vercel (gratuit)

1. [vercel.com/new](https://vercel.com/new) → repo GitHub.
2. **Root Directory** : `frontend`
3. **Build** : `npm run build` · **Output** : `dist`

Variables :

| Variable | Valeur |
|----------|--------|
| `VITE_API_URL` | `https://nexapay-api.onrender.com/api` |
| `VITE_GOOGLE_CLIENT_ID` | … |
| `VITE_APPLE_CLIENT_ID` | `com.nexapay.app` |

Deploy → copier l’URL Vercel.

### Mettre à jour Render

`FRONTEND_URL` = URL Vercel exacte → **Redeploy**.

---

## Étape 4 — OAuth

**Google** : ajouter l’URL Vercel dans *Authorized JavaScript origins* (+ `http://localhost:5173` en dev).

**Apple** : return URLs pour l’URL Vercel.

---

## Étape 5 — Tests

| Test | Note |
|------|------|
| `/api/health` | Peut être lent au 1er appel (réveil) |
| Inscription OTP | SMTP requis |
| Paiement sandbox | Si webhook rate, revenir sur `/pay/success?quoteId=…` |
| CORS | `FRONTEND_URL` doit matcher Vercel |

---

## Dépannage (plan gratuit)

| Problème | Solution |
|----------|----------|
| API très lente | Service endormi — attendre ~1 min ou UptimeRobot 14 min |
| Paiement pas à jour | Ouvrir le lien succès Fedapay ; `confirm-quote` rattrape |
| CORS | `FRONTEND_URL` exact + redeploy Render |
| `Network Error` | `VITE_API_URL` avec `/api` + rebuild Vercel |

---

## Quand vous aurez un budget

| Upgrade | Pourquoi |
|---------|----------|
| Render **Starter** (~7 $/mois) | API 24/7, webhooks Fedapay fiables |
| Neon payant | Plus de stockage / branches |

---

## Coût total au démarrage (Vercel × 2 + Neon)

| Service | Plan | Coût |
|---------|------|------|
| Neon | Free | **0 €** |
| Vercel (frontend) | Hobby | **0 €** |
| Vercel (backend) | Hobby | **0 €** |
| **Total** | | **0 €** |

---

## Fichiers utiles

- `frontend/src/lib/api.ts` — `VITE_API_URL`
- `backend/src/app.ts` — app Express (Vercel + local)
- `backend/api/index.ts` — entrée serverless Vercel
- `backend/vercel.json` — routing API
- `frontend/vercel.json` — SPA
- `render.yaml` — option Render (alternative)
