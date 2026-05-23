import 'package:dio/dio.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import '../models/user.dart';
import 'api_client.dart';

class AuthService {
  static final _googleSignIn = GoogleSignIn(scopes: ['email', 'profile']);

  static Future<Map<String, dynamic>> login(String email, String password) async {
    final res = await ApiClient.instance.post('/auth/login', data: {
      'email': email,
      'password': password,
    });
    return res.data;
  }

  static Future<Map<String, dynamic>> register(
      String name, String email, String password, String? companyName,
      {String? phone, String phoneCountry = 'bj'}) async {
    final res = await ApiClient.instance.post('/auth/register', data: {
      'name': name,
      'email': email,
      'password': password,
      if (companyName != null && companyName.isNotEmpty) 'companyName': companyName,
      if (phone != null && phone.isNotEmpty) 'phone': phone,
      'phoneCountry': phoneCountry,
    });
    return res.data;
  }

  static Future<Map<String, dynamic>> verifyEmail(String email, String code) async {
    final res = await ApiClient.instance.post('/auth/verify-email', data: {
      'email': email,
      'code': code,
    });
    return res.data;
  }

  static Future<void> resendOtp(String email) async {
    await ApiClient.instance.post('/auth/resend-otp', data: {'email': email});
  }

  static Future<Map<String, dynamic>> googleSignIn() async {
    final account = await _googleSignIn.signIn();
    if (account == null) throw Exception('Connexion Google annulée');

    final auth = await account.authentication;
    final idToken = auth.idToken;
    if (idToken == null) throw Exception('Token Google introuvable');

    final res = await ApiClient.instance.post('/auth/google', data: {'idToken': idToken});
    return res.data;
  }

  static Future<Map<String, dynamic>> appleSignIn() async {
    final credential = await SignInWithApple.getAppleIDCredential(
      scopes: [
        AppleIDAuthorizationScopes.email,
        AppleIDAuthorizationScopes.fullName,
      ],
    );

    final res = await ApiClient.instance.post('/auth/apple', data: {
      'identityToken': credential.identityToken,
      'user': {
        'name': {
          'firstName': credential.givenName,
          'lastName': credential.familyName,
        },
        'email': credential.email,
      },
    });
    return res.data;
  }

  static Future<User> getMe() async {
    final res = await ApiClient.instance.get('/auth/me');
    return User.fromJson(res.data);
  }

  static Future<User> updateMe(Map<String, dynamic> data) async {
    final res = await ApiClient.instance.put('/auth/me', data: data);
    return User.fromJson(res.data);
  }

  static Future<User> uploadAvatar(String filePath) async {
    final formData = FormData.fromMap({
      'image': await MultipartFile.fromFile(filePath, filename: 'avatar.jpg'),
    });
    final res = await ApiClient.instance.post('/upload/avatar', data: formData);
    return User.fromJson(res.data);
  }

  static Future<User> deleteAvatar() async {
    final res = await ApiClient.instance.delete('/upload/avatar');
    return User.fromJson(res.data);
  }

  static Future<User> uploadQuoteLogo(String filePath) async {
    final formData = FormData.fromMap({
      'image': await MultipartFile.fromFile(filePath, filename: 'quote-logo.jpg'),
    });
    final res = await ApiClient.instance.post('/upload/quote-logo', data: formData);
    return User.fromJson(res.data);
  }

  static Future<User> deleteQuoteLogo() async {
    final res = await ApiClient.instance.delete('/upload/quote-logo');
    return User.fromJson(res.data);
  }
}
