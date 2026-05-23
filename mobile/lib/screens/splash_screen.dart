import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme.dart';
import '../providers/theme_provider.dart';

class SplashScreen extends StatefulWidget {
  final VoidCallback onDone;
  const SplashScreen({super.key, required this.onDone});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _fadeIn;
  late Animation<double> _scale;
  late Animation<double> _taglineFade;
  late Animation<double> _fadeOut;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2800),
    );

    // Logo apparaît avec scale + fade (0 → 600 ms)
    _scale = Tween<double>(begin: 0.72, end: 1.0).animate(
      CurvedAnimation(
        parent: _ctrl,
        curve: const Interval(0.0, 0.22, curve: Curves.easeOutBack),
      ),
    );
    _fadeIn = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _ctrl,
        curve: const Interval(0.0, 0.22, curve: Curves.easeOut),
      ),
    );

    // Tagline slide up (600 → 1000 ms)
    _taglineFade = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _ctrl,
        curve: const Interval(0.22, 0.40, curve: Curves.easeOut),
      ),
    );

    // Tout disparaît (2400 → 2800 ms)
    _fadeOut = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _ctrl,
        curve: const Interval(0.86, 1.0, curve: Curves.easeIn),
      ),
    );

    _ctrl.forward().then((_) => widget.onDone());
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.appBg,
      body: AnimatedBuilder(
        animation: _ctrl,
        builder: (_, __) {
          return FadeTransition(
            opacity: _fadeOut,
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Logo tel quel, sans filtre de couleur
                  ScaleTransition(
                    scale: _scale,
                    child: FadeTransition(
                      opacity: _fadeIn,
                      child: Builder(builder: (ctx) {
                        final isDark = ctx.watch<ThemeProvider>().effectiveIsDark(ctx);
                        return Image.asset(
                          isDark ? 'lib/assets/Logo-dark.png' : 'lib/assets/Logo.png',
                          height: 160,
                          filterQuality: FilterQuality.high,
                        );
                      }),
                    ),
                  ),
                  const SizedBox(height: 24),
                  // Tagline
                  FadeTransition(
                    opacity: _taglineFade,
                    child: SlideTransition(
                      position: Tween<Offset>(
                        begin: const Offset(0, 0.4),
                        end: Offset.zero,
                      ).animate(CurvedAnimation(
                        parent: _ctrl,
                        curve: const Interval(0.22, 0.40, curve: Curves.easeOut),
                      )),
                      child: Text(
                        'Vos devis, professionnels et rapides.',
                        style: TextStyle(
                          color: context.appTextMuted,
                          fontSize: 13.5,
                          fontWeight: FontWeight.w400,
                          letterSpacing: 0.1,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
