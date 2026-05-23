class QuoteItem {
  final String? id;
  final String description;
  final double quantity;
  final double unitPrice;
  final double total;
  final String? unit;
  final String? productId;
  final int order;

  QuoteItem({
    this.id,
    required this.description,
    required this.quantity,
    required this.unitPrice,
    required this.total,
    this.unit,
    this.productId,
    required this.order,
  });

  factory QuoteItem.fromJson(Map<String, dynamic> json) => QuoteItem(
        id: json['id'],
        description: json['description'],
        quantity: (json['quantity'] as num).toDouble(),
        unitPrice: (json['unitPrice'] as num).toDouble(),
        total: (json['total'] as num).toDouble(),
        unit: json['unit'],
        productId: json['productId'],
        order: json['order'] ?? 0,
      );

  Map<String, dynamic> toJson() => {
        'description': description,
        'quantity': quantity,
        'unitPrice': unitPrice,
        if (unit != null) 'unit': unit,
        if (productId != null) 'productId': productId,
      };
}

class QuoteUser {
  final String? name;
  final String? companyName;
  final String? phone;
  final String? address;
  final String? ifu;
  final String? rccm;
  final String? email;
  final String? logoUrl;
  final String? quoteLogoUrl;
  final bool useProfilePhotoAsLogo;

  QuoteUser({
    this.name,
    this.companyName,
    this.phone,
    this.address,
    this.ifu,
    this.rccm,
    this.email,
    this.logoUrl,
    this.quoteLogoUrl,
    this.useProfilePhotoAsLogo = true,
  });

  factory QuoteUser.fromJson(Map<String, dynamic> json) => QuoteUser(
        name: json['name'],
        companyName: json['companyName'],
        phone: json['phone'],
        address: json['address'],
        ifu: json['ifu'],
        rccm: json['rccm'],
        email: json['email'],
        logoUrl: json['logoUrl'],
        quoteLogoUrl: json['quoteLogoUrl'],
        useProfilePhotoAsLogo: json['useProfilePhotoAsLogo'] ?? true,
      );
}

class QuoteClient {
  final String id;
  final String name;
  final String color;

  QuoteClient({required this.id, required this.name, required this.color});

  factory QuoteClient.fromJson(Map<String, dynamic> json) => QuoteClient(
        id: json['id'],
        name: json['name'],
        color: json['color'] ?? '#0F8F65',
      );
}

enum QuoteStatus { draft, sent, paid, overdue }

QuoteStatus quoteStatusFromString(String s) {
  switch (s.toUpperCase()) {
    case 'SENT':
      return QuoteStatus.sent;
    case 'PAID':
      return QuoteStatus.paid;
    case 'OVERDUE':
      return QuoteStatus.overdue;
    default:
      return QuoteStatus.draft;
  }
}

String quoteStatusLabel(QuoteStatus s) {
  switch (s) {
    case QuoteStatus.draft:
      return 'Brouillon';
    case QuoteStatus.sent:
      return 'Envoyé';
    case QuoteStatus.paid:
      return 'Payé';
    case QuoteStatus.overdue:
      return 'En retard';
  }
}

class Quote {
  final String id;
  final String number;
  final String title;
  final String clientId;
  final QuoteClient? client;
  final QuoteStatus status;
  final String? notes;
  final double taxRate;
  final double discount;
  final double subtotal;
  final double taxAmount;
  final double total;
  final int validDays;
  final DateTime? issuedAt;
  final DateTime? sentAt;
  final DateTime? paidAt;
  final String? paymentRef;
  final String? paymentUrl;
  final bool paidViaLink;
  final DateTime createdAt;
  final List<QuoteItem> items;
  final QuoteUser? user;

  Quote({
    required this.id,
    required this.number,
    required this.title,
    required this.clientId,
    this.client,
    this.user,
    required this.status,
    this.notes,
    required this.taxRate,
    required this.discount,
    required this.subtotal,
    required this.taxAmount,
    required this.total,
    required this.validDays,
    this.issuedAt,
    this.sentAt,
    this.paidAt,
    this.paymentRef,
    this.paymentUrl,
    this.paidViaLink = false,
    required this.createdAt,
    required this.items,
  });

  /// True when a payment link is active and we're waiting for the client to pay.
  bool get isAwaitingPayment =>
      status == QuoteStatus.sent && paymentRef != null && paymentRef!.isNotEmpty;

  factory Quote.fromJson(Map<String, dynamic> json) => Quote(
        id: json['id'],
        number: json['number'],
        title: json['title'],
        clientId: json['clientId'],
        client: json['client'] != null
            ? QuoteClient.fromJson(json['client'])
            : null,
        user: json['user'] != null ? QuoteUser.fromJson(json['user']) : null,
        status: quoteStatusFromString(json['status']),
        notes: json['notes'],
        taxRate: (json['taxRate'] as num).toDouble(),
        discount: (json['discount'] as num).toDouble(),
        subtotal: (json['subtotal'] as num).toDouble(),
        taxAmount: (json['taxAmount'] as num).toDouble(),
        total: (json['total'] as num).toDouble(),
        validDays: json['validDays'] ?? 30,
        issuedAt:
            json['issuedAt'] != null ? DateTime.parse(json['issuedAt']) : null,
        sentAt: json['sentAt'] != null ? DateTime.parse(json['sentAt']) : null,
        paidAt: json['paidAt'] != null ? DateTime.parse(json['paidAt']) : null,
        paymentRef: json['paymentRef'],
        paymentUrl: json['paymentUrl'],
        paidViaLink: json['paidViaLink'] ?? false,
        createdAt: DateTime.parse(json['createdAt']),
        items: (json['items'] as List<dynamic>?)
                ?.map((e) => QuoteItem.fromJson(e))
                .toList() ??
            [],
      );
}
