import '../models/payout.dart';
import '../models/quota.dart';
import '../models/user.dart';
import 'api_client.dart';

class PaymentService {
  // ── Quotas ────────────────────────────────────────────────────────────────
  static Future<Quota> getQuota() async {
    final res = await ApiClient.instance.get('/payments/quota');
    return Quota.fromJson(res.data);
  }

  // ── Quote payment link (Fedapay checkout for the freelancer's client) ────
  static Future<({String paymentUrl, String shareUrl})> initiatePayment(
      String quoteId) async {
    final res =
        await ApiClient.instance.post('/payments/initiate/$quoteId');
    return (
      paymentUrl: res.data['paymentUrl'] as String,
      shareUrl: (res.data['shareUrl'] ?? '') as String,
    );
  }

  /// Force a Fedapay status check for a quote (when looking at a SENT quote).
  /// Returns `true` if the quote just flipped to PAID.
  static Future<bool> checkQuotePayment(String quoteId) async {
    final res =
        await ApiClient.instance.post('/quotes/$quoteId/check-payment');
    return (res.data['changed'] as bool?) ?? false;
  }

  // ── Plan upgrade ──────────────────────────────────────────────────────────
  static Future<({String paymentUrl, String transactionId, int amount})> upgradePlan(
    String plan, {
    String interval = 'monthly',
  }) async {
    final res = await ApiClient.instance.post(
      '/payments/upgrade',
      data: {'plan': plan, 'interval': interval},
    );
    return (
      paymentUrl: res.data['paymentUrl'] as String,
      transactionId: '${res.data['transactionId']}',
      amount: (res.data['amount'] as num?)?.toInt() ?? 0,
    );
  }

  /// Idempotent — called after the Fedapay redirect to activate the plan.
  static Future<User> confirmUpgrade({
    required String transactionId,
    required String plan,
    String interval = 'monthly',
  }) async {
    final res = await ApiClient.instance.post(
      '/payments/confirm-upgrade',
      data: {
        'transactionId': transactionId,
        'plan': plan,
        'interval': interval,
      },
    );
    return User.fromJson(res.data['user']);
  }

  // ── Payouts (Mes reversements) ────────────────────────────────────────────
  static Future<List<Payout>> getPayouts() async {
    final res = await ApiClient.instance.get('/payments/history');
    return (res.data as List).map((e) => Payout.fromJson(e)).toList();
  }

  /// Re-tries a failed payout to the user's MoMo number.
  static Future<Payout> retryPayout(String paymentId) async {
    final res =
        await ApiClient.instance.post('/payments/$paymentId/retry');
    return Payout.fromJson(res.data);
  }

  // ── Public client-facing payment page (no auth) ──────────────────────────
  static Future<Map<String, dynamic>> getPublicQuote(String quoteId) async {
    final res = await ApiClient.instance.get('/payments/quote/$quoteId');
    return res.data;
  }
}
