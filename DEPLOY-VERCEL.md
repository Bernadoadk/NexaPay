# NexaPay — Déploiement pas à pas (Neon + 2 projets Vercel)

Coût total : **0 €** (Neon Free + Vercel Hobby × 2).

Avant de commencer : le code doit être sur **GitHub** (`git push`).

---

# Partie A — Neon (base de données)

## A1. Créer le projet

1. Aller sur [console.neon.tech](https://console.neon.tech) → se connecter.
2. **New Project** → nom : `nexapay` → région : **Europe** (proche du Bénin).
3. Attendre la création (~30 s).

## A2. Récupérer l’URL de connexion

1. Dashboard du projet → **Connection details**.
2. Choisir **Pooled connection** (important pour Vercel).
3. Copier la chaîne qui ressemble à :
   ```
   postgresql://user:pass@ep-xxxx-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Garder cette URL — c’est votre **`DATABASE_URL`**.

## A3. Créer les tables (sur votre PC)

1. Ouvrir `backend/.env` en local.
2. Remplacer `DATABASE_URL` par l’URL Neon copiée.
3. Dans un terminal :

```bash
cd backend
npx prisma db push
```

Message attendu : migrations appliquées / base synchronisée.

4. (Optionnel) données de test :
```bash
npm run db:seed
```

✅ **Neon terminé** — ne partagez jamais `DATABASE_URL` publiquement.

---

# Partie B — Projet Vercel #1 : BACKEND (API)

URL finale exemple : `https://nexapay-api.vercel.app`

## B1. Importer le repo

1. [vercel.com/new](https://vercel.com/new)
2. **Import** votre repo GitHub (DeviBenin / NexaPay).
3. **Ne pas** cliquer Deploy tout de suite — configurer d’abord.

## B2. Réglages du projet

| Champ | Valeur exacte |
|-------|----------------|
| **Project Name** | `nexapay-api` |
| **Framework Preset** | Other |
| **Root Directory** | Cliquer **Edit** → taper `backend` → **Continue** |
| **Build Command** | `npm run build` (génère Prisma uniquement) |
| **Output Directory** | `public` *(dossier `backend/public` dans le repo)* |
| **Install Command** | `npm install` |

Vercel détecte `backend/vercel.json` automatiquement.

## B3. Variables d’environnement

Cliquer **Environment Variables** et ajouter **une par une** :

| Nom | Valeur | Où la trouver |
|-----|--------|----------------|
| `DATABASE_URL` | URL pooled Neon (partie A) | Neon dashboard |
| `JWT_SECRET` | Chaîne longue aléatoire | Générer : `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `NODE_ENV` | `production` | — |
| `FRONTEND_URL` | `https://nexapay.vercel.app` | **Provisoire** — vous la corrigerez en partie C |
| `SMTP_HOST` | ex. `smtp.gmail.com` | Votre `backend/.env` |
| `SMTP_PORT` | `587` | idem |
| `SMTP_SECURE` | `false` | idem |
| `SMTP_USER` | votre email | idem |
| `SMTP_PASS` | mot de passe app | idem |
| `GOOGLE_CLIENT_ID` | `xxx.apps.googleusercontent.com` | Google Cloud + `frontend/.env` |
| `APPLE_CLIENT_ID` | `com.nexapay.app` | idem |
| `CLOUDINARY_CLOUD_NAME` | … | `backend/.env` |
| `CLOUDINARY_API_KEY` | … | idem |
| `CLOUDINARY_API_SECRET` | … | idem |
| `FEDAPAY_ENV` | `sandbox` | idem |
| `FEDAPAY_SECRET_KEY` | … | idem |
| `OPENAI_API_KEY` | `sk-…` | idem |
| `OPENAI_MODEL` | `gpt-4o-mini` | idem |

Cocher **Production**, **Preview**, **Development** pour chaque variable.

> Ne pas ajouter `PORT` — Vercel le gère.

## B4. Déployer

1. Cliquer **Deploy**.
2. Attendre le build vert (~2–5 min).
3. Noter l’URL : ex. `https://nexapay-api.vercel.app`

## B5. Vérifier que l’API répond

Ouvrir dans le navigateur :

```
https://nexapay-api.vercel.app/api/health
```

Réponse attendue :

```json
{"status":"ok"}
```

Si erreur 500 : Vercel → projet `nexapay-api` → **Deployments** → clic sur le déploiement → **Logs**.

## B6. Fedapay (webhook)

Dashboard Fedapay → **Webhooks** → ajouter :

```
https://nexapay-api.vercel.app/api/payments/webhook
```

(Remplacez par votre vraie URL si le nom de projet diffère.)

✅ **Backend Vercel terminé** (sauf `FRONTEND_URL` à finaliser après partie C).

---

# Partie C — Projet Vercel #2 : FRONTEND (app web)

URL finale exemple : `https://nexapay.vercel.app`

## C1. Nouveau projet (même repo)

1. [vercel.com/new](https://vercel.com/new) — **encore une fois** le **même** repo GitHub.
2. Vercel peut proposer d’ajouter un projet au repo — accepter.

## C2. Réglages du projet

| Champ | Valeur exacte |
|-------|----------------|
| **Project Name** | `nexapay` |
| **Framework Preset** | Vite |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

## C3. Variables d’environnement

| Nom | Valeur |
|-----|--------|
| `VITE_API_URL` | `https://nexapay-api.vercel.app/api` |
| `VITE_GOOGLE_CLIENT_ID` | Même que `GOOGLE_CLIENT_ID` du backend |
| `VITE_APPLE_CLIENT_ID` | `com.nexapay.app` |

⚠️ `VITE_API_URL` **doit** finir par `/api` (sans slash après `api`).

Cocher Production + Preview + Development.

## C4. Déployer

1. **Deploy** → attendre build vert.
2. Noter l’URL réelle : ex. `https://nexapay.vercel.app`  
   (ou `https://nexapay-xxx.vercel.app` si le nom est pris)

## C5. Relier backend ↔ frontend (important)

### Sur le projet **backend** (`nexapay-api`)

1. Vercel → projet **nexapay-api** → **Settings** → **Environment Variables**
2. Modifier `FRONTEND_URL` = URL exacte du frontend (partie C4), ex. :
   ```
   https://nexapay.vercel.app
   ```
   Sans `/` à la fin.
3. **Deployments** → dernier déploiement → **⋯** → **Redeploy**

### Sur le projet **frontend** (si l’URL API était différente)

Si votre API n’est pas `nexapay-api.vercel.app`, corriger `VITE_API_URL` puis **Redeploy**.

## C6. Vérifier l’app

1. Ouvrir `https://nexapay.vercel.app`
2. Tester **Inscription** ou **Connexion**
3. Si erreur réseau / CORS :
   - `FRONTEND_URL` sur le backend = URL frontend exacte
   - `VITE_API_URL` = URL backend + `/api`
   - Redéployer les deux projets

✅ **Frontend Vercel terminé**

---

# Partie D — OAuth (Google & Apple)

## Google

1. [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials
2. Client OAuth **Web**
3. **Authorized JavaScript origins** — ajouter :
   - `https://nexapay.vercel.app` (votre URL frontend)
   - `http://localhost:5173`
4. Enregistrer

## Apple

Configurer Sign in with Apple pour le domaine / l’URL de production Vercel.

---

# Partie E — Checklist finale

| # | Test | OK ? |
|---|------|------|
| 1 | `GET …/api/health` → `{"status":"ok"}` | ☐ |
| 2 | Page login s’affiche | ☐ |
| 3 | Inscription + email OTP | ☐ |
| 4 | Connexion Google | ☐ |
| 5 | Créer un client / devis | ☐ |
| 6 | Lien paiement `/pay/…` | ☐ |

---

# Dépannage rapide

| Problème | Solution |
|----------|----------|
| CORS / bloqué par le navigateur | `FRONTEND_URL` = URL Vercel frontend exacte → redeploy backend |
| Network Error | `VITE_API_URL` avec `/api` → redeploy frontend |
| 500 sur `/api/health` | Logs Vercel backend ; vérifier `DATABASE_URL` Neon pooled |
| Build backend « No Output Directory public » | Output Directory = `public` ; pousser le dernier code (`backend/public/`) |
| Build backend échoue | Logs : souvent `prisma generate` — vérifier `DATABASE_URL` |
| Build frontend logos / `import.meta.env` | Pousser le dernier code (`vite-env.d.ts`, `public/logo.svg`) |
| API lente au 1er clic | Normal (cold start Vercel gratuit) |

---

# Résumé des 2 projets Vercel

| | Projet 1 — Backend | Projet 2 — Frontend |
|---|-------------------|---------------------|
| **Nom** | `nexapay-api` | `nexapay` |
| **Dossier** | `backend` | `frontend` |
| **URL** | `https://nexapay-api.vercel.app` | `https://nexapay.vercel.app` |
| **Variable clé** | `FRONTEND_URL` → URL frontend | `VITE_API_URL` → URL backend + `/api` |

Les deux projets sont **séparés** dans le dashboard Vercel mais partagent le **même repo GitHub**.
