class User {
  final String id;
  final String email;
  final String name;
  final String? companyName;
  final String? phone;
  final String? address;
  final String? ifu;
  final String? rccm;
  final String? logoUrl;
  final String? quoteLogoUrl;
  final bool useProfilePhotoAsLogo;
  final String plan;
  final DateTime? planExpiresAt;
  final String planInterval; // 'monthly' | 'annual'
  final int aiCredits;
  final String phoneCountry;

  User({
    required this.id,
    required this.email,
    required this.name,
    this.companyName,
    this.phone,
    this.address,
    this.ifu,
    this.rccm,
    this.logoUrl,
    this.quoteLogoUrl,
    this.useProfilePhotoAsLogo = true,
    required this.plan,
    this.planExpiresAt,
    this.planInterval = 'monthly',
    this.aiCredits = 0,
    this.phoneCountry = 'bj',
  });

  /// True when MoMo payouts are blocked because no phone is set.
  bool get needsMomoSetup => phone == null || phone!.trim().isEmpty;

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: json['id'],
        email: json['email'],
        name: json['name'],
        companyName: json['companyName'],
        phone: json['phone'],
        address: json['address'],
        ifu: json['ifu'],
        rccm: json['rccm'],
        logoUrl: json['logoUrl'],
        quoteLogoUrl: json['quoteLogoUrl'],
        useProfilePhotoAsLogo: json['useProfilePhotoAsLogo'] ?? true,
        plan: json['plan'] ?? 'FREE',
        planExpiresAt: json['planExpiresAt'] != null
            ? DateTime.parse(json['planExpiresAt'])
            : null,
        planInterval: json['planInterval'] ?? 'monthly',
        aiCredits: (json['aiCredits'] as num?)?.toInt() ?? 0,
        phoneCountry: json['phoneCountry'] ?? 'bj',
      );
}
