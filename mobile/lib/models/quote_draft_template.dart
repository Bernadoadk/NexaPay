import 'quote.dart';

class QuoteDraftTemplate {
  final String id;
  final String name;
  final String? category;
  final String? description;
  final String title;
  final String? notes;
  final double taxRate;
  final double discount;
  final double subtotal;
  final double taxAmount;
  final double total;
  final int validDays;
  final int usageCount;
  final DateTime? lastUsedAt;
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<QuoteItem> items;

  QuoteDraftTemplate({
    required this.id,
    required this.name,
    this.category,
    this.description,
    required this.title,
    this.notes,
    required this.taxRate,
    required this.discount,
    required this.subtotal,
    required this.taxAmount,
    required this.total,
    required this.validDays,
    required this.usageCount,
    this.lastUsedAt,
    required this.createdAt,
    required this.updatedAt,
    required this.items,
  });

  factory QuoteDraftTemplate.fromJson(Map<String, dynamic> json) =>
      QuoteDraftTemplate(
        id: json['id'],
        name: json['name'],
        category: json['category'],
        description: json['description'],
        title: json['title'],
        notes: json['notes'],
        taxRate: (json['taxRate'] as num).toDouble(),
        discount: (json['discount'] as num).toDouble(),
        subtotal: (json['subtotal'] as num).toDouble(),
        taxAmount: (json['taxAmount'] as num).toDouble(),
        total: (json['total'] as num).toDouble(),
        validDays: json['validDays'] ?? 30,
        usageCount: json['usageCount'] ?? 0,
        lastUsedAt: json['lastUsedAt'] != null
            ? DateTime.parse(json['lastUsedAt'])
            : null,
        createdAt: DateTime.parse(json['createdAt']),
        updatedAt: DateTime.parse(json['updatedAt']),
        items: (json['items'] as List<dynamic>?)
                ?.map((e) => QuoteItem.fromJson(e))
                .toList() ??
            [],
      );
}
