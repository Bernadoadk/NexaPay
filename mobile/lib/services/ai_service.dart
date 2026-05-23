import 'api_client.dart';

class AiQuoteResult {
  final String? title;
  final List<({String description, double quantity, double unitPrice})> items;
  final int aiCredits;

  AiQuoteResult({this.title, required this.items, required this.aiCredits});

  factory AiQuoteResult.fromJson(Map<String, dynamic> json) {
    final raw = (json['items'] as List<dynamic>?) ?? [];
    return AiQuoteResult(
      title: json['title'],
      items: raw
          .map((e) => (
                description: e['description'] as String,
                quantity: (e['quantity'] as num).toDouble(),
                unitPrice: (e['unitPrice'] as num).toDouble(),
              ))
          .toList(),
      aiCredits: (json['aiCredits'] as num?)?.toInt() ?? 0,
    );
  }
}

class AiPriceSuggestion {
  final double min;
  final double max;
  final double average;
  final String currency;
  final String advice;
  final int aiCredits;

  AiPriceSuggestion({
    required this.min,
    required this.max,
    required this.average,
    required this.currency,
    required this.advice,
    required this.aiCredits,
  });

  factory AiPriceSuggestion.fromJson(Map<String, dynamic> json) =>
      AiPriceSuggestion(
        min: (json['min'] as num).toDouble(),
        max: (json['max'] as num).toDouble(),
        average: (json['average'] as num).toDouble(),
        currency: json['currency'] ?? 'FCFA',
        advice: json['advice'] ?? '',
        aiCredits: (json['aiCredits'] as num?)?.toInt() ?? 0,
      );
}

/// AI endpoints — each call costs 1 credit and is refunded server-side on failure.
class AiService {
  static Future<AiQuoteResult> generateQuote(String description) async {
    final res = await ApiClient.instance
        .post('/ai/generate-quote', data: {'description': description});
    return AiQuoteResult.fromJson(res.data);
  }

  static Future<AiPriceSuggestion> suggestPrice({
    required String service,
    String city = 'Cotonou',
    String? details,
  }) async {
    final res = await ApiClient.instance.post('/ai/suggest-price', data: {
      'service': service,
      'city': city,
      if (details != null) 'details': details,
    });
    return AiPriceSuggestion.fromJson(res.data);
  }

  static Future<({String improved, int aiCredits})> improveText({
    required String text,
    String? context,
  }) async {
    final res = await ApiClient.instance.post('/ai/improve-text', data: {
      'text': text,
      if (context != null) 'context': context,
    });
    return (
      improved: res.data['improved'] as String,
      aiCredits: (res.data['aiCredits'] as num?)?.toInt() ?? 0,
    );
  }
}
