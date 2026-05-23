import 'package:flutter/material.dart';
import '../theme.dart';
import '../utils/nav.dart';
import '../widgets/momo_setup_banner.dart';
import 'dashboard/dashboard_screen.dart';
import 'quotes/quotes_screen.dart';
import 'quotes/create_quote_screen.dart';
import 'clients/clients_screen.dart';
import 'settings/settings_screen.dart';

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _currentIndex = 0;

  void _onNavTap(int navIndex) {
    if (navIndex == 2) {
      Navigator.push(context, fadeSlideRoute(const CreateQuoteScreen()));
      return;
    }
    setState(() => _currentIndex = navIndex > 2 ? navIndex - 1 : navIndex);
  }

  @override
  Widget build(BuildContext context) {
    // Settings is index 3 — banner is irrelevant there since that's exactly
    // where the user goes to fix the issue.
    final onSettings = _currentIndex == 3;
    return Scaffold(
      body: Column(
        children: [
          MomoSetupBanner(
            hideWhenSafe: onSettings,
            onConfigure: () => setState(() => _currentIndex = 3),
          ),
          Expanded(
            child: IndexedStack(
              index: _currentIndex,
              children: [
                DashboardScreen(
                    onSwitchTab: (i) => setState(() => _currentIndex = i)),
                const QuotesScreen(),
                const ClientsScreen(),
                const SettingsScreen(),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: context.appSurface,
          border: Border(top: BorderSide(color: context.appBorder)),
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 62,
            child: Row(
              children: [
                _NavItem(
                    icon: Icons.home_outlined,
                    activeIcon: Icons.home_rounded,
                    label: 'Accueil',
                    navIndex: 0,
                    current: _currentIndex,
                    onTap: _onNavTap),
                _NavItem(
                    icon: Icons.description_outlined,
                    activeIcon: Icons.description_rounded,
                    label: 'Devis',
                    navIndex: 1,
                    current: _currentIndex,
                    onTap: _onNavTap),
                _FabNavItem(onTap: () => _onNavTap(2)),
                _NavItem(
                    icon: Icons.people_outline,
                    activeIcon: Icons.people_rounded,
                    label: 'Clients',
                    navIndex: 3,
                    current: _currentIndex,
                    onTap: _onNavTap),
                _NavItem(
                    icon: Icons.settings_outlined,
                    activeIcon: Icons.settings_rounded,
                    label: 'Réglages',
                    navIndex: 4,
                    current: _currentIndex,
                    onTap: _onNavTap),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final int navIndex;
  final int current;
  final void Function(int) onTap;

  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.navIndex,
    required this.current,
    required this.onTap,
  });

  bool get _active =>
      current == (navIndex > 2 ? navIndex - 1 : navIndex);

  @override
  Widget build(BuildContext context) {
    final active = _active;
    return Expanded(
      child: GestureDetector(
        onTap: () => onTap(navIndex),
        behavior: HitTestBehavior.opaque,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              active ? activeIcon : icon,
              size: 22,
              color: active ? AppColors.primary : context.appTextMuted,
            ),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                fontSize: 10.5,
                fontWeight:
                    active ? FontWeight.w600 : FontWeight.w500,
                color: active ? AppColors.primary : context.appTextMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FabNavItem extends StatelessWidget {
  final VoidCallback onTap;

  const _FabNavItem({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Center(
        child: GestureDetector(
          onTap: onTap,
          child: Transform.translate(
            offset: const Offset(0, -12),
            child: Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withOpacity(0.45),
                    blurRadius: 14,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Icon(Icons.add_rounded,
                  color: Colors.white, size: 26),
            ),
          ),
        ),
      ),
    );
  }
}
