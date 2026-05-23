enum PayoutStatus { pending, transferring, transferred, failed }

PayoutStatus payoutStatusFrom(String s) {
  switch (s.toUpperCase()) {
    case 'TRANSFERRING':
      return PayoutStatus.transferring;
    case 'TRANSFERRED':
      return PayoutStatus.transferred;
    case 'FAILED':
      return PayoutStatus.failed;
    default:
      return PayoutStatus.pending;
  }
}

String payoutStatusLabel(PayoutStatus s) {
  switch (s) {
    case PayoutStatus.pending:
      return 'En attente';
    case PayoutStatus.transferring:
      return 'En cours';
    case PayoutStatus.transferred:
      return 'Reversé';
    case PayoutStatus.failed:
      return 'Échec';
  }
}

/// Slim quote info bundled into the payout for the list view.
class PayoutQuote {
  final String number;
  final String title;
  final double total;
  final DateTime? paidAt;

  PayoutQuote({
    required this.number,
    required this.title,
    required this.total,
    this.paidAt,
  });

  factory PayoutQuote.fromJson(Map<String, dynamic> json) => PayoutQuote(
        number: json['number'] ?? '—',
        title: json['title'] ?? '',
        total: (json['total'] as num?)?.toDouble() ?? 0,
        paidAt:
            json['paidAt'] != null ? DateTime.parse(json['paidAt']) : null,
      );
}

class Payout {
  final String id;
  final String quoteId;
  final double grossAmount;
  final double commission;
  final double netAmount;
  final PayoutStatus status;
  final String? fedapayTxId;
  final String? transferId;
  final DateTime? transferredAt;
  final String? failReason;
  final DateTime createdAt;
  final PayoutQuote? quote;

  Payout({
    required this.id,
    required this.quoteId,
    required this.grossAmount,
    required this.commission,
    required this.netAmount,
    required this.status,
    this.fedapayTxId,
    this.transferId,
    this.transferredAt,
    this.failReason,
    required this.createdAt,
    this.quote,
  });

  bool get isPending =>
      status == PayoutStatus.pending || status == PayoutStatus.transferring;
  bool get isFailed => status == PayoutStatus.failed;

  factory Payout.fromJson(Map<String, dynamic> json) => Payout(
        id: json['id'],
        quoteId: json['quoteId'],
        grossAmount: (json['grossAmount'] as num).toDouble(),
        commission: (json['commission'] as num).toDouble(),
        netAmount: (json['netAmount'] as num).toDouble(),
        status: payoutStatusFrom(json['status'] ?? 'PENDING'),
        fedapayTxId: json['fedapayTxId'],
        transferId: json['transferId'],
        transferredAt: json['transferredAt'] != null
            ? DateTime.parse(json['transferredAt'])
            : null,
        failReason: json['failReason'],
        createdAt: DateTime.parse(json['createdAt']),
        quote: json['quote'] != null ? PayoutQuote.fromJson(json['quote']) : null,
      );
}
