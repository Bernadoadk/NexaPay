import 'package:flutter/material.dart';
import '../theme.dart';

class QuotaBar extends StatelessWidget {
  final int used;
  final int limit;
  final String plan;

  const QuotaBar({
    super.key,
    required this.used,
    required this.limit,
    required this.plan,
  });

  double get _ratio => limit > 0 ? (used / limit).clamp(0.0, 1.0) : 0;

  Color get _color {
    if (_ratio >= 0.9) return AppColors.statusOverdue;
    if (_ratio >= 0.7) return const Color(0xFFF59E0B);
    return AppColors.statusPaid;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Quota devis — Plan $plan',
                style: TextStyle(fontSize: 12, color: context.appTextMuted),
              ),
            ),
            Text(
              '$used / $limit',
              style: TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w600, color: _color),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: _ratio),
            duration: const Duration(milliseconds: 900),
            curve: Curves.easeOutCubic,
            builder: (_, v, __) => LinearProgressIndicator(
              value: v,
              minHeight: 6,
              backgroundColor: context.appBorder,
              valueColor: AlwaysStoppedAnimation(_color),
            ),
          ),
        ),
        if (_ratio >= 0.9)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              limit - used <= 0
                  ? 'Quota épuisé — passez au plan supérieur'
                  : 'Plus que ${limit - used} devis disponible(s)',
              style: TextStyle(fontSize: 11, color: _color),
            ),
          ),
      ],
    );
  }
}
