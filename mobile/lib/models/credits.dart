class CreditPack {
  final String id;
  final int credits;
  final int price;
  final String label;

  const CreditPack({
    required this.id,
    required this.credits,
    required this.price,
    required this.label,
  });

  factory CreditPack.fromJson(Map<String, dynamic> json) => CreditPack(
        id: json['id'],
        credits: (json['credits'] as num).toInt(),
        price: (json['price'] as num).toInt(),
        label: json['label'] ?? '',
      );
}

class CreditBalance {
  final int aiCredits;
  final String plan;
  final String planInterval;
  final int monthlyQuota;
  final int cap;
  final List<CreditPack> packs;

  CreditBalance({
    required this.aiCredits,
    required this.plan,
    required this.planInterval,
    required this.monthlyQuota,
    required this.cap,
    required this.packs,
  });

  factory CreditBalance.fromJson(Map<String, dynamic> json) => CreditBalance(
        aiCredits: (json['aiCredits'] as num?)?.toInt() ?? 0,
        plan: json['plan'] ?? 'FREE',
        planInterval: json['planInterval'] ?? 'monthly',
        monthlyQuota: (json['monthlyQuota'] as num?)?.toInt() ?? 0,
        cap: (json['cap'] as num?)?.toInt() ?? 0,
        packs: (json['packs'] as List<dynamic>?)
                ?.map((e) => CreditPack.fromJson(e))
                .toList() ??
            [],
      );
}

class CreditTransaction {
  final String id;
  final int amount;
  final String type; // signup_bonus | plan_renewal | purchase | ai_use | refund
  final String description;
  final int balanceAfter;
  final DateTime createdAt;

  CreditTransaction({
    required this.id,
    required this.amount,
    required this.type,
    required this.description,
    required this.balanceAfter,
    required this.createdAt,
  });

  factory CreditTransaction.fromJson(Map<String, dynamic> json) =>
      CreditTransaction(
        id: json['id'],
        amount: (json['amount'] as num).toInt(),
        type: json['type'] ?? '',
        description: json['description'] ?? '',
        balanceAfter: (json['balanceAfter'] as num).toInt(),
        createdAt: DateTime.parse(json['createdAt']),
      );
}
