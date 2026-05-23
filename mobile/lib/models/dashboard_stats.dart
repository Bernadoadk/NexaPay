import 'quote.dart';

class DashboardStats {
  final int totalQuotes;
  final int totalClients;
  final double revenue;
  final int revenueGrowth;
  final double pending;
  final int overdueCount;
  final List<Quote> recentQuotes;

  DashboardStats({
    required this.totalQuotes,
    required this.totalClients,
    required this.revenue,
    required this.revenueGrowth,
    required this.pending,
    required this.overdueCount,
    required this.recentQuotes,
  });

  factory DashboardStats.fromJson(Map<String, dynamic> json) => DashboardStats(
        totalQuotes: json['totalQuotes'] ?? 0,
        totalClients: json['totalClients'] ?? 0,
        revenue: (json['revenue'] as num?)?.toDouble() ?? 0.0,
        revenueGrowth: json['revenueGrowth'] ?? 0,
        pending: (json['pending'] as num?)?.toDouble() ?? 0.0,
        overdueCount: json['overdueCount'] ?? 0,
        recentQuotes: (json['recentQuotes'] as List<dynamic>?)
                ?.map((e) => Quote.fromJson(e))
                .toList() ??
            [],
      );
}
