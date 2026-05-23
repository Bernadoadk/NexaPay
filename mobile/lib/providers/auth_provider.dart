import 'package:flutter/material.dart';
import '../models/user.dart';
import '../services/auth_service.dart';
import '../services/api_client.dart';

class AuthProvider extends ChangeNotifier {
  User? _user;
  bool _isLoading = true;
  String? _pendingEmail;

  User? get user => _user;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _user != null;
  String? get pendingEmail => _pendingEmail;

  Future<void> checkAuth() async {
    final token = await ApiClient.getToken();
    if (token == null) {
      _isLoading = false;
      notifyListeners();
      return;
    }
    try {
      _user = await AuthService.getMe();
    } catch (_) {
      await ApiClient.clearToken();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Returns true if login succeeded, false if OTP verification needed.
  Future<bool> login(String email, String password) async {
    final data = await AuthService.login(email, password);
    if (data['requiresVerification'] == true) {
      _pendingEmail = data['email'] as String;
      notifyListeners();
      return false;
    }
    await ApiClient.saveToken(data['token']);
    _user = User.fromJson(data['user']);
    _pendingEmail = null;
    notifyListeners();
    return true;
  }

  /// Returns true if register succeeded, false if OTP verification needed.
  Future<bool> register(String name, String email, String password, String? companyName,
      {String? phone, String phoneCountry = 'bj'}) async {
    final data = await AuthService.register(name, email, password, companyName,
        phone: phone, phoneCountry: phoneCountry);
    if (data['requiresVerification'] == true) {
      _pendingEmail = data['email'] as String;
      notifyListeners();
      return false;
    }
    await ApiClient.saveToken(data['token']);
    _user = User.fromJson(data['user']);
    _pendingEmail = null;
    notifyListeners();
    return true;
  }

  Future<void> verifyOtp(String email, String code) async {
    final data = await AuthService.verifyEmail(email, code);
    await ApiClient.saveToken(data['token']);
    _user = User.fromJson(data['user']);
    _pendingEmail = null;
    notifyListeners();
  }

  Future<void> resendOtp(String email) async {
    await AuthService.resendOtp(email);
  }

  Future<void> loginWithGoogle() async {
    final data = await AuthService.googleSignIn();
    await ApiClient.saveToken(data['token']);
    _user = User.fromJson(data['user']);
    _pendingEmail = null;
    notifyListeners();
  }

  Future<void> loginWithApple() async {
    final data = await AuthService.appleSignIn();
    await ApiClient.saveToken(data['token']);
    _user = User.fromJson(data['user']);
    _pendingEmail = null;
    notifyListeners();
  }

  Future<void> logout() async {
    await ApiClient.clearToken();
    _user = null;
    _pendingEmail = null;
    notifyListeners();
  }

  Future<void> updateProfile(Map<String, dynamic> data) async {
    _user = await AuthService.updateMe(data);
    notifyListeners();
  }

  Future<void> uploadAvatar(String filePath) async {
    _user = await AuthService.uploadAvatar(filePath);
    notifyListeners();
  }

  Future<void> deleteAvatar() async {
    _user = await AuthService.deleteAvatar();
    notifyListeners();
  }

  Future<void> uploadQuoteLogo(String filePath) async {
    _user = await AuthService.uploadQuoteLogo(filePath);
    notifyListeners();
  }

  Future<void> deleteQuoteLogo() async {
    _user = await AuthService.deleteQuoteLogo();
    notifyListeners();
  }

  Future<void> setUseProfilePhotoAsLogo(bool value) async {
    _user = await AuthService.updateMe({'useProfilePhotoAsLogo': value});
    notifyListeners();
  }
}
