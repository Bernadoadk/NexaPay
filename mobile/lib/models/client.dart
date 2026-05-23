class Client {
  final String id;
  final String name;
  final String? contact;
  final String? email;
  final String? phone;
  final String? phoneCountry;
  final String? city;
  final String? address;
  final String? ifu;
  final String color;
  final int quotesCount;
  final double totalBilled;
  final DateTime createdAt;

  Client({
    required this.id,
    required this.name,
    this.contact,
    this.email,
    this.phone,
    this.phoneCountry,
    this.city,
    this.address,
    this.ifu,
    required this.color,
    required this.quotesCount,
    required this.totalBilled,
    required this.createdAt,
  });

  factory Client.fromJson(Map<String, dynamic> json) => Client(
        id: json['id'],
        name: json['name'],
        contact: json['contact'],
        email: json['email'],
        phone: json['phone'],
        phoneCountry: json['phoneCountry'],
        city: json['city'],
        address: json['address'],
        ifu: json['ifu'],
        color: json['color'] ?? '#0F8F65',
        quotesCount: json['quotesCount'] ?? 0,
        totalBilled: (json['totalBilled'] as num?)?.toDouble() ?? 0.0,
        createdAt: DateTime.parse(json['createdAt']),
      );
}
