import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiClient {
  // ───────────────────────────────────────────────────────────────
  // Choix automatique de l'URL d'API selon la cible :
  //   • Web local (flutter run -d chrome, en mode debug) → backend local
  //   • Émulateur Android                                → 10.0.2.2 (host local depuis l'AVD)
  //   • Web buildé / appareil réel / release            → URL publique (ngrok ou prod)
  //
  // Pour basculer rapidement, surcharge `--dart-define=API_URL=...` :
  //   flutter run -d chrome --dart-define=API_URL=https://moi.ngrok-free.app/api
  // ───────────────────────────────────────────────────────────────
  static const String _localWebUrl   = 'http://localhost:3001/api';
  static const String _emulatorUrl   = 'http://10.0.2.2:3001/api';
  static const String _ngrokUrl      = 'https://e50c-137-255-127-158.ngrok-free.app/api';
  // Override possible au build / au lancement.
  static const String _overrideUrl   = String.fromEnvironment('API_URL', defaultValue: '');

  static String get baseUrl {
    if (_overrideUrl.isNotEmpty) return _overrideUrl;
    if (kIsWeb)     return kDebugMode ? _localWebUrl : _ngrokUrl;
    return _emulatorUrl;
  }

  static final Dio _dio = Dio(BaseOptions(
    baseUrl: baseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 15),
    headers: {
      'Content-Type': 'application/json',
      // Bypass de l'avertissement Ngrok — sans effet si la cible est localhost.
      'ngrok-skip-browser-warning': 'true',
    },
  ));

  // Sur le web, on stocke le token en mémoire (pas de secure storage)
  static String? _memToken;

  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static Future<void> init() async {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await getToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
  }

  static Dio get instance => _dio;

  static Future<void> saveToken(String token) async {
    if (kIsWeb) {
      _memToken = token;
    } else {
      await _storage.write(key: 'token', value: token);
    }
  }

  static Future<void> clearToken() async {
    if (kIsWeb) {
      _memToken = null;
    } else {
      await _storage.delete(key: 'token');
    }
  }

  static Future<String?> getToken() async {
    if (kIsWeb) return _memToken;
    return _storage.read(key: 'token');
  }
}
