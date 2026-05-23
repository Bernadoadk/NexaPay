import 'package:flutter/foundation.dart';
import '../models/credits.dart';
import '../services/credits_service.dart';

/// Holds the AI credit balance app-wide so the chip in the topbar, the
/// "Plus" sheet and the Credits screen stay in sync after every AI call.
class CreditsProvider extends ChangeNotifier {
  CreditBalance? _balance;
  bool _loading = false;
  Object? _error;

  CreditBalance? get balance => _balance;
  bool get loading => _loading;
  Object? get error => _error;

  int get aiCredits => _balance?.aiCredits ?? 0;
  int get monthlyQuota => _balance?.monthlyQuota ?? 0;
  bool get isLow => aiCredits < 5;
  List<CreditPack> get packs => _balance?.packs ?? const [];

  Future<void> refresh({bool silent = false}) async {
    if (!silent) {
      _loading = true;
      notifyListeners();
    }
    try {
      _balance = await CreditsService.getBalance();
      _error = null;
    } catch (e) {
      _error = e;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Optimistic local decrement used right after a successful AI call so the
  /// chip updates instantly — followed by a `refresh()` to reconcile.
  void localUseCredit(int amount) {
    if (_balance == null) return;
    _balance = CreditBalance(
      aiCredits: (_balance!.aiCredits - amount).clamp(0, 1 << 31),
      plan: _balance!.plan,
      planInterval: _balance!.planInterval,
      monthlyQuota: _balance!.monthlyQuota,
      cap: _balance!.cap,
      packs: _balance!.packs,
    );
    notifyListeners();
  }

  void clear() {
    _balance = null;
    _error = null;
    notifyListeners();
  }
}
