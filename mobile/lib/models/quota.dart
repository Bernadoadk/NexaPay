class Quota {
  final int used;
  final int limit;
  final String plan;
  final int remaining;

  Quota({
    required this.used,
    required this.limit,
    required this.plan,
    required this.remaining,
  });

  factory Quota.fromJson(Map<String, dynamic> json) => Quota(
        used: json['used'] ?? 0,
        limit: json['limit'] ?? 5,
        plan: json['plan'] ?? 'FREE',
        remaining: json['remaining'] ?? 0,
      );

  double get ratio => limit > 0 ? (used / limit).clamp(0.0, 1.0) : 0;
  bool get isExhausted => remaining <= 0;
}
