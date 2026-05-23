import '../models/credits.dart';
import 'api_client.dart';

class CreditsService {
  /// Current AI credit balance + plan + available packs.
  static Future<CreditBalance> getBalance() async {
    final res = await ApiClient.instance.get('/credits/balance');
    return CreditBalance.fromJson(res.data);
  }

  /// Recent credit transactions for the history screen.
  static Future<List<CreditTransaction>> getHistory() async {
    final res = await ApiClient.instance.get('/credits/history');
    final list = res.data as List<dynamic>;
    return list.map((e) => CreditTransaction.fromJson(e)).toList();
  }

  /// Kick off a Fedapay payment to buy a credit pack — returns the checkout URL.
  static Future<({String paymentUrl, String transactionId})> purchase(
      String packId) async {
    final res = await ApiClient.instance
        .post('/credits/purchase', data: {'packId': packId});
    return (
      paymentUrl: res.data['paymentUrl'] as String,
      transactionId: '${res.data['transactionId']}',
    );
  }

  /// Idempotent confirmation called after the Fedapay redirect.
  static Future<CreditBalance> confirmPurchase(
      String transactionId, String packId) async {
    await ApiClient.instance.post(
      '/credits/confirm-purchase',
      data: {'transactionId': transactionId, 'packId': packId},
    );
    // Always re-fetch the canonical balance afterwards.
    return getBalance();
  }
}
