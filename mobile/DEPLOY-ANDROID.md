# NexaPay — Déploiement Android

Deux façons de distribuer l’app :

| Méthode | Fichier | Usage |
|---------|---------|--------|
| **APK** | `.apk` | Tests, partage direct (WhatsApp, site web) |
| **AAB** | `.aab` | **Google Play Store** (obligatoire pour publication) |

L’app release appelle automatiquement : `https://nexapay-api.vercel.app/api`

---

## 0. Prérequis (sur votre PC Windows)

1. **Flutter** : [flutter.dev/docs/get-started/install/windows](https://docs.flutter.dev/get-started/install/windows)
2. Vérifier :

```bash
flutter doctor
```

Tout doit être OK pour **Android toolchain** (Android Studio + SDK).

3. Accepter les licences :

```bash
flutter doctor --android-licenses
```

---

## 1. Installer les dépendances

```bash
cd mobile
flutter pub get
```

---

## 2. Tester sur un téléphone (USB)

1. Activer **Options développeur** + **Débogage USB** sur le téléphone.
2. Brancher en USB → autoriser le PC.
3. Lancer en **release** (API prod) :

```bash
flutter run --release
```

Ou en debug sur appareil réel (API prod forcée) :

```bash
flutter run --dart-define=API_URL=https://nexapay-api.vercel.app/api
```

> En debug sur **émulateur**, l’app utilise `http://10.0.2.2:3001/api` (backend local).

---

## 3. Créer une clé de signature (une seule fois)

Pour publier sur le Play Store (ou un APK « officiel »), créez un keystore :

```bash
cd mobile/android
keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

- Notez **mot de passe** et **alias** (`upload`) dans un endroit sûr.
- **Ne perdez jamais** ce fichier `.jks` — impossible de mettre à jour l’app sur le Play Store sans lui.

Créer `mobile/android/key.properties` (copier depuis `key.properties.example`) :

```properties
storePassword=VOTRE_MOT_DE_PASSE
keyPassword=VOTRE_MOT_DE_PASSE
keyAlias=upload
storeFile=upload-keystore.jks
```

`key.properties` et `*.jks` sont déjà dans `.gitignore`.

---

## 4. Build APK (installation directe)

```bash
cd mobile
flutter build apk --release
```

Fichier généré :

```
mobile/build/app/outputs/flutter-apk/app-release.apk
```

Envoyez ce fichier aux testeurs → ils activent **Sources inconnues** → installent.

---

## 5. Build AAB (Google Play Store)

```bash
cd mobile
flutter build appbundle --release
```

Fichier généré :

```
mobile/build/app/outputs/bundle/release/app-release.aab
```

---

## 6. Publier sur Google Play

1. Compte [Google Play Console](https://play.google.com/console) — frais unique ~25 $.
2. **Créer une application** → NexaPay.
3. **Production** (ou Tests internes) → **Créer une version** → importer `app-release.aab`.
4. Remplir : fiche store, captures d’écran, politique de confidentialité, classification du contenu.
5. Soumettre pour examen (quelques heures à quelques jours).

Identifiant Android : **`com.nexapay.app`**

---

## 7. Connexion Google sur Android (important)

Pour **Continuer avec Google** sur l’APK release :

1. Obtenir l’empreinte **SHA-1** du keystore de release :

```bash
cd mobile/android
keytool -list -v -keystore upload-keystore.jks -alias upload
```

2. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials.
3. Client OAuth **Android** (ou modifier le client existant) :
   - Package : `com.nexapay.app`
   - SHA-1 : celui du keystore **release**
4. Pour les tests en debug, ajouter aussi le SHA-1 **debug** :

```bash
keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
```

Sans SHA-1 Android, Google Sign-In échoue sur l’APK release.

---

## 8. Checklist avant publication

| # | Vérification |
|---|----------------|
| 1 | Inscription / connexion email OK |
| 2 | Connexion Google OK (SHA-1 configuré) |
| 3 | Création devis, clients, PDF |
| 4 | Lien paiement MoMo (plan Pro+) |
| 5 | Backend prod : `/api/health` OK |
| 6 | `FRONTEND_URL` / CORS si besoin webhooks |

---

## 9. Commandes utiles

```bash
# Nettoyer un build raté
flutter clean && flutter pub get

# APK plus léger (par ABI)
flutter build apk --release --split-per-abi

# Voir les appareils connectés
flutter devices
```

---

## Dépannage

| Problème | Solution |
|----------|----------|
| `Unable to locate Android SDK` | Installer Android Studio + SDK |
| App ne joint pas l’API | Vérifier `--release` ou `API_URL` prod |
| Google Sign-In échec | SHA-1 + package `com.nexapay.app` dans Google Cloud |
| Play refuse l’AAB | Incrémenter `version: 1.0.1+2` dans `pubspec.yaml` (+1 sur le nombre après `+`) |
