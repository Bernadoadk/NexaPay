import 'package:flutter/material.dart';
import '../theme.dart';

enum ConfirmActionTone { danger, warning, primary }

Future<bool> showConfirmActionSheet({
  required BuildContext context,
  required String title,
  required String message,
  required String confirmLabel,
  String cancelLabel = 'Annuler',
  ConfirmActionTone tone = ConfirmActionTone.danger,
  IconData? icon,
}) async {
  final result = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) {
      final isDark = Theme.of(sheetContext).brightness == Brightness.dark;
      final color = switch (tone) {
        ConfirmActionTone.danger => AppColors.statusOverdue,
        ConfirmActionTone.warning => const Color(0xFFC2691B),
        ConfirmActionTone.primary => AppColors.primary,
      };
      final bg = switch (tone) {
        ConfirmActionTone.danger =>
          isDark ? const Color(0xFF3D1515) : const Color(0xFFFEE2E2),
        ConfirmActionTone.warning =>
          isDark ? const Color(0xFF431A07) : const Color(0xFFFFF7ED),
        ConfirmActionTone.primary =>
          isDark ? AppColors.primarySoftDark : AppColors.primarySoft,
      };
      final actionIcon = icon ??
          switch (tone) {
            ConfirmActionTone.danger => Icons.delete_outline_rounded,
            ConfirmActionTone.warning => Icons.warning_amber_rounded,
            ConfirmActionTone.primary => Icons.check_circle_outline_rounded,
          };

      return SafeArea(
        top: false,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(22, 12, 22, 22),
          decoration: BoxDecoration(
            color: sheetContext.appSurface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
            border: Border(top: BorderSide(color: sheetContext.appBorder)),
            boxShadow: const [
              BoxShadow(
                blurRadius: 28,
                offset: Offset(0, -8),
                color: Color(0x26000000),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 38,
                  height: 4,
                  decoration: BoxDecoration(
                    color: sheetContext.appBorderStrong,
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: bg,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: color.withOpacity(0.22)),
                    ),
                    child: Icon(actionIcon, color: color, size: 24),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: TextStyle(
                            color: sheetContext.appText,
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.2,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          message,
                          style: TextStyle(
                            color: sheetContext.appTextMuted,
                            fontSize: 13,
                            height: 1.45,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 22),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(sheetContext, false),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: sheetContext.appText,
                        side: BorderSide(color: sheetContext.appBorderStrong),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: Text(cancelLabel),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(sheetContext, true),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: color,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: Text(confirmLabel),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      );
    },
  );

  return result ?? false;
}
