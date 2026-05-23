# Déploiement NexaPay — 0 € (Neon + Vercel × 2)

## Architecture recommandée (tout sur Vercel)

**Deux projets Vercel distincts**, même repo GitHub, même hébergeur :

```
GitHub (monorepo)
├── frontend/  →  Projet Vercel #1  →  https://nexapay.vercel.app
└── backend/   →  Projet Vercel #2  →  https://nexapay-api.vercel.app
         │
         └── Neon (PostgreSQL)  →  DATABASE_URL
```

| Composant | Où | Coût |
|-----------|-----|------|
| Base de données | [Neon](https://neon.tech) Free | **0 €** |
| API (Express) | Vercel — projet **backend** | **0 €** |
| Frontend React | Vercel — projet **frontend** | **0 €** |

Le frontend appelle le backend via `VITE_API_URL`. Le backend autorise le frontend via `FRONTEND_URL` (CORS).

**Ordre :** Neon → Vercel backend → Vercel frontend → Fedapay / OAuth.

---

<details>
<summary>Alternative : backend sur Render (plan gratuit)</summary>

Voir section en bas du fichier ou historique Render. Vercel × 2 évite la mise en veille Render (~15 min).
</details>

---

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
| `VITE_API_URL` | `https://nexapay-api.vercel.app/api` |
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
