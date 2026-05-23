# DevisPro Bénin — Application Flutter

## Prérequis

- Flutter SDK >= 3.3.0
- Android Studio ou VS Code avec l'extension Flutter
- Un émulateur Android ou appareil physique

## Démarrage rapide

```bash
cd mobile
flutter pub get
flutter run
```

## Configuration du backend

Par défaut l'app pointe sur `http://10.0.2.2:3001/api` (émulateur Android).

Pour changer l'URL, éditez `lib/services/api_client.dart` :

```dart
// Émulateur Android
static const String baseUrl = 'http://10.0.2.2:3001/api';

// Simulateur iOS
static const String baseUrl = 'http://localhost:3001/api';

// Appareil physique (remplace par l'IP du PC)
static const String baseUrl = 'http://192.168.1.x:3001/api';
```

## Structure du projet

```
lib/
├── main.dart              # Point d'entrée
├── theme.dart             # Couleurs et thème (vert #0F8F65)
├── models/                # Modèles de données
│   ├── user.dart
│   ├── client.dart
│   ├── quote.dart
│   └── dashboard_stats.dart
├── services/              # Appels API
│   ├── api_client.dart    # Dio + JWT
│   ├── auth_service.dart
│   ├── quote_service.dart
│   ├── client_service.dart
│   └── dashboard_service.dart
├── providers/             # État global (Provider)
│   ├── auth_provider.dart
│   ├── quotes_provider.dart
│   └── clients_provider.dart
├── widgets/               # Composants réutilisables
│   ├── avatar_widget.dart
│   └── status_badge.dart
└── screens/
    ├── main_screen.dart   # Bottom nav + FAB
    ├── auth/
    │   ├── login_screen.dart
    │   └── register_screen.dart
    ├── dashboard/
    │   └── dashboard_screen.dart
    ├── quotes/
    │   ├── quotes_screen.dart
    │   ├── quote_detail_screen.dart
    │   └── create_quote_screen.dart
    ├── clients/
    │   └── clients_screen.dart
    └── settings/
        └── settings_screen.dart
```

## Permissions Android

Ajouter dans `android/app/src/main/AndroidManifest.xml` :

```xml
<uses-permission android:name="android.permission.INTERNET"/>
```
