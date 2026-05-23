import 'package:flutter/material.dart';
import '../models/quote.dart';
import '../theme.dart';

class StatusBadge extends StatelessWidget {
  final QuoteStatus status;

  const StatusBadge({super.key, required this.status});

  Color get _color {
    switch (status) {
      case QuoteStatus.draft:
        return AppColors.statusDraft;
      case QuoteStatus.sent:
        return AppColors.statusSent;
      case QuoteStatus.paid:
        return AppColors.statusPaid;
      case QuoteStatus.overdue:
        return AppColors.statusOverdue;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: _color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: _color.withOpacity(0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 5,
            height: 5,
            decoration: BoxDecoration(color: _color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(
            quoteStatusLabel(status),
            style: TextStyle(
              color: _color,
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
