import '../models/quote.dart';
import 'api_client.dart';

class QuoteService {
  static Future<List<Quote>> getAll({String? status, String? clientId}) async {
    final res = await ApiClient.instance.get('/quotes', queryParameters: {
      if (status != null) 'status': status,
      if (clientId != null) 'clientId': clientId,
    });
    return (res.data as List).map((e) => Quote.fromJson(e)).toList();
  }

  static Future<Quote> getById(String id) async {
    final res = await ApiClient.instance.get('/quotes/$id');
    return Quote.fromJson(res.data);
  }

  static Future<Quote> create({
    required String title,
    required String clientId,
    required List<QuoteItem> items,
    String? notes,
    double taxRate = 18,
    double discount = 0,
    int validDays = 30,
  }) async {
    final res = await ApiClient.instance.post('/quotes', data: {
      'title': title,
      'clientId': clientId,
      'items': items.map((e) => e.toJson()).toList(),
      if (notes != null) 'notes': notes,
      'taxRate': taxRate,
      'discount': discount,
      'validDays': validDays,
    });
    return Quote.fromJson(res.data);
  }

  static Future<Quote> updateStatus(String id, String status) async {
    final res = await ApiClient.instance
        .patch('/quotes/$id/status', data: {'status': status});
    return Quote.fromJson(res.data);
  }

  static Future<Quote> duplicate(String id) async {
    final res = await ApiClient.instance.post('/quotes/$id/duplicate');
    return Quote.fromJson(res.data);
  }

  static Future<void> delete(String id) async {
    await ApiClient.instance.delete('/quotes/$id');
  }
}
