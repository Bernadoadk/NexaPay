import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/credits_provider.dart';
import '../theme.dart';

/// Compact chip showing the current AI credit balance — tappable to open
/// the credits screen / pricing. Mirrors the React `<Sidebar>` credits card.
class AiCreditsChip extends StatelessWidget {
  final VoidCallback? onTap;
  final bool dense;

  const AiCreditsChip({super.key, this.onTap, this.dense = false});

  @override
  Widget build(BuildContext context) {
    final credits = context.watch<CreditsProvider>();
    final aiCredits = credits.aiCredits;
    final low = credits.isLow;
    final bg = low
        ? const Color(0xFFFEF3C7) // amber-50
        : AppColors.primarySoft;
    final bgDark = low
        ? const Color(0xFF431A07).withOpacity(0.4)
        : AppColors.primarySoftDark;
    final fg = low ? const Color(0xFFA1530F) : AppColors.primaryDark;
    final fgDark = low ? const Color(0xFFFCD34D) : AppColors.primaryHoverDark;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap ?? () => Navigator.of(context).pushNamed('/credits'),
        child: Container(
          padding: EdgeInsets.symmetric(
            horizontal: dense ? 8 : 10,
            vertical: dense ? 4 : 5,
          ),
          decoration: BoxDecoration(
            color: isDark ? bgDark : bg,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: (isDark ? fgDark : fg).withOpacity(0.25),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.auto_awesome_rounded,
                size: dense ? 12 : 14,
                color: isDark ? fgDark : fg,
              ),
              const SizedBox(width: 4),
              Text(
                '$aiCredits',
                style: TextStyle(
                  fontSize: dense ? 11.5 : 12.5,
                  fontWeight: FontWeight.w700,
                  color: isDark ? fgDark : fg,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
