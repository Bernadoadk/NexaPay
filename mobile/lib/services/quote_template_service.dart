import '../models/quote.dart';
import '../models/quote_draft_template.dart';
import 'api_client.dart';

class QuoteTemplateService {
  static Future<List<QuoteDraftTemplate>> getAll() async {
    final res = await ApiClient.instance.get('/quote-templates');
    return (res.data as List)
        .map((e) => QuoteDraftTemplate.fromJson(e))
        .toList();
  }

  static Future<QuoteDraftTemplate> create({
    required String name,
    String? category,
    String? description,
    required String title,
    String? notes,
    required List<QuoteItem> items,
    double taxRate = 18,
    double discount = 0,
    int validDays = 30,
  }) async {
    final res = await ApiClient.instance.post('/quote-templates', data: {
      'name': name,
      if (category != null && category.trim().isNotEmpty)
        'category': category.trim(),
      if (description != null && description.trim().isNotEmpty)
        'description': description.trim(),
      'title': title,
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
      'items': items.map((e) => e.toJson()).toList(),
      'taxRate': taxRate,
      'discount': discount,
      'validDays': validDays,
    });
    return QuoteDraftTemplate.fromJson(res.data);
  }

  static Future<QuoteDraftTemplate> createFromQuote({
    required String quoteId,
    required String name,
    String? category,
    String? description,
  }) async {
    final res = await ApiClient.instance
        .post('/quote-templates/from-quote/$quoteId', data: {
      'name': name,
      if (category != null && category.trim().isNotEmpty)
        'category': category.trim(),
      if (description != null && description.trim().isNotEmpty)
        'description': description.trim(),
    });
    return QuoteDraftTemplate.fromJson(res.data);
  }

  static Future<QuoteDraftTemplate> markUsed(String id) async {
    final res = await ApiClient.instance.post('/quote-templates/$id/use');
    return QuoteDraftTemplate.fromJson(res.data);
  }

  static Future<void> delete(String id) async {
    await ApiClient.instance.delete('/quote-templates/$id');
  }
}
