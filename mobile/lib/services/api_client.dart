import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiClient {
  // ── URLs API ──────────────────────────────────────────────────
  // Prod : API Vercel (release + appareil réel en prod)
  static const String _prodUrl = 'https://nexapay-api.vercel.app/api';
  // Dev local
  static const String _localWebUrl = 'http://localhost:3001/api';
  static const String _emulatorUrl = 'http://10.0.2.2:3001/api';
  // Override au build : --dart-define=API_URL=https://...
  static const String _overrideUrl = String.fromEnvironment('API_URL', defaultValue: '');

  static String get baseUrl {
    if (_overrideUrl.isNotEmpty) return _overrideUrl;
    // Release (APK/AAB Play Store) → toujours la prod
    if (kReleaseMode) return _prodUrl;
    // Debug web
    if (kIsWeb) return _localWebUrl;
    // Debug émulateur Android
    return _emulatorUrl;
  }

  static final Dio _dio = Dio(BaseOptions(
    baseUrl: baseUrl,
    connectTimeout: const Duration(seconds: 30),
    receiveTimeout: const Duration(seconds: 60),
    headers: {'Content-Type': 'application/json'},
  ));

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
