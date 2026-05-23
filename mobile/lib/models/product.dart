class Product {
  final String id;
  final String name;
  final String? description;
  final String? category;
  final double price;
  final String? unit;
  final bool archived;
  final int usageCount;
  final double totalBilled;
  final DateTime createdAt;

  Product({
    required this.id,
    required this.name,
    this.description,
    this.category,
    required this.price,
    this.unit,
    this.archived = false,
    this.usageCount = 0,
    this.totalBilled = 0,
    required this.createdAt,
  });

  factory Product.fromJson(Map<String, dynamic> json) => Product(
        id: json['id'],
        name: json['name'],
        description: json['description'],
        category: json['category'],
        price: (json['price'] as num).toDouble(),
        unit: json['unit'],
        archived: json['archived'] ?? false,
        usageCount: (json['usageCount'] as num?)?.toInt() ?? 0,
        totalBilled: (json['totalBilled'] as num?)?.toDouble() ?? 0,
        createdAt: DateTime.parse(json['createdAt']),
      );

  Map<String, dynamic> toJson() => {
        'name': name,
        'price': price,
        if (description != null) 'description': description,
        if (category != null) 'category': category,
        if (unit != null) 'unit': unit,
      };
}

/// Sort options used by the products list (matches the web API).
enum ProductSort {
  name,
  priceAsc,
  priceDesc,
  used,
  recent;

  String get apiValue {
    switch (this) {
      case ProductSort.name: return 'name';
      case ProductSort.priceAsc: return 'price-asc';
      case ProductSort.priceDesc: return 'price-desc';
      case ProductSort.used: return 'used';
      case ProductSort.recent: return 'recent';
    }
  }

  String get label {
    switch (this) {
      case ProductSort.name: return 'Nom (A→Z)';
      case ProductSort.priceAsc: return 'Prix croissant';
      case ProductSort.priceDesc: return 'Prix décroissant';
      case ProductSort.used: return 'Plus utilisés';
      case ProductSort.recent: return 'Récents';
    }
  }
}
