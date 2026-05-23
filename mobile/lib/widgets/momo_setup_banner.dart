import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';

/// Persistent amber banner shown above any screen when the user has no MoMo
/// number configured. Without one, incoming client payments cannot be paid
/// out, so we keep this VERY visible until they fix it.
///
/// The whole tile is tappable — the [onConfigure] callback should navigate
/// to the Settings screen (route or tab switch). On root screens that can't
/// directly navigate, pass `onConfigure` that pops/switches.
///
/// Pass [hideWhenSafe] = true if the wrapping screen is the Settings screen
/// itself, so we don't show the banner there.
class MomoSetupBanner extends StatelessWidget {
  final VoidCallback? onConfigure;
  final bool hideWhenSafe;

  const MomoSetupBanner({
    super.key,
    this.onConfigure,
    this.hideWhenSafe = false,
  });

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    if (user == null || !user.needsMomoSetup || hideWhenSafe) {
      return const SizedBox.shrink();
    }

    return Material(
      color: const Color(0xFFFEF3C7),
      child: InkWell(
        onTap: onConfigure,
        child: Container(
          decoration: const BoxDecoration(
            border: Border(
              bottom: BorderSide(color: Color(0xFFFCD34D)),
            ),
          ),
          padding: const EdgeInsets.fromLTRB(14, 10, 12, 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const Icon(
                Icons.warning_amber_rounded,
                color: Color(0xFF92400E),
                size: 18,
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Text.rich(
                  TextSpan(
                    style: TextStyle(
                      fontSize: 12,
                      color: Color(0xFF92400E),
                      height: 1.35,
                    ),
                    children: [
                      TextSpan(
                        text: 'MoMo non configuré.',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                      TextSpan(
                        text:
                            ' Vos paiements clients ne pourront pas vous être reversés.',
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFF92400E),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'Configurer',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
