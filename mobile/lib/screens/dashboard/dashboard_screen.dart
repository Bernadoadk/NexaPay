import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../theme.dart';
import '../../models/dashboard_stats.dart';
import '../../models/quota.dart';
import '../../models/quote.dart';
import '../../services/dashboard_service.dart';
import '../../services/payment_service.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/avatar_widget.dart';
import '../../widgets/status_badge.dart';
import '../../widgets/animated_counter.dart';
import '../../widgets/slide_in.dart';
import '../../widgets/quota_bar.dart';
import '../../widgets/ai_credits_chip.dart';
import '../../providers/credits_provider.dart';
import '../quotes/quote_detail_screen.dart';
import '../quotes/create_quote_screen.dart';
import '../plan/plan_screen.dart';

class DashboardScreen extends StatefulWidget {
  final void Function(int tab)? onSwitchTab;
  const DashboardScreen({super.key, this.onSwitchTab});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  DashboardStats? _stats;
  Quota? _quota;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
    // Pull the AI credit balance once the dashboard mounts so the chip in
    // the header (and the "Plus" sheet later) shows real data.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<CreditsProvider>().refresh(silent: true);
    });
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        DashboardService.getStats(),
        PaymentService.getQuota(),
      ]);
      if (mounted) {
        setState(() {
          _stats = results[0] as DashboardStats;
          _quota = results[1] as Quota;
        });
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _fmtXOF(double n) {
    if (n >= 1000000) {
      return '${(n / 1000000).toStringAsFixed(1)} M F';
    }
    final s = n.toStringAsFixed(0);
    final buf = StringBuffer();
    int count = 0;
    for (int i = s.length - 1; i >= 0; i--) {
      if (count > 0 && count % 3 == 0) buf.write(' ');
      buf.write(s[i]);
      count++;
    }
    return '${buf.toString().split('').reversed.join()} F';
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final top = MediaQuery.of(context).padding.top;

    return Scaffold(
      backgroundColor: context.appBg,
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: _load,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            // ── Header ──────────────────────────────────────────────────
            SliverToBoxAdapter(
              child: SlideIn(
                delay: const Duration(milliseconds: 0),
                child: _buildHeader(user?.name ?? '', top),
              ),
            ),

            if (_loading)
              const SliverFillRemaining(
                child: Center(
                    child: CircularProgressIndicator(color: AppColors.primary)),
              )
            else ...[
              // ── Hero card ───────────────────────────────────────────
              SliverToBoxAdapter(
                child: SlideIn(
                  delay: const Duration(milliseconds: 80),
                  child: _buildHeroCard(),
                ),
              ),

              // ── Stat row ────────────────────────────────────────────
              SliverToBoxAdapter(
                child: SlideIn(
                  delay: const Duration(milliseconds: 140),
                  child: _buildStatRow(),
                ),
              ),

              // ── Quota bar ───────────────────────────────────────────
              if (_quota != null)
                SliverToBoxAdapter(
                  child: SlideIn(
                    delay: const Duration(milliseconds: 180),
                    child: _buildQuotaCard(),
                  ),
                ),

              // ── Quick actions ────────────────────────────────────────
              SliverToBoxAdapter(
                child: SlideIn(
                  delay: const Duration(milliseconds: 220),
                  child: _buildQuickActions(),
                ),
              ),

              // ── Recent quotes header ─────────────────────────────────
              SliverToBoxAdapter(
                child: SlideIn(
                  delay: const Duration(milliseconds: 260),
                  child: _buildRecentHeader(),
                ),
              ),

              // ── Recent quotes list (staggered) ───────────────────────
              SliverList(
                delegate: SliverChildBuilderDelegate(
                  (ctx, i) {
                    final q = _stats?.recentQuotes[i];
                    if (q == null) return null;
                    return SlideIn(
                      delay: Duration(milliseconds: 300 + i * 60),
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(18, 0, 18, 8),
                        child: _QuoteCard(
                          quote: q,
                          fmtXOF: _fmtXOF,
                          onTap: () => _push(QuoteDetailScreen(quoteId: q.id)),
                        ),
                      ),
                    );
                  },
                  childCount: _stats?.recentQuotes.length ?? 0,
                ),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: 32)),
            ],
          ],
        ),
      ),
    );
  }

  // ────────────────────────────────────────────────────────────────────────────

  Widget _buildHeader(String name, double top) {
    final first = name.split(' ').first;
    return Container(
      padding: EdgeInsets.fromLTRB(18, top + 14, 18, 16),
      child: Row(
        children: [
          AvatarWidget(name: name.isNotEmpty ? name : 'U', color: '#14201C', size: 38),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Bonjour 👋',
                    style: TextStyle(fontSize: 12, color: context.appTextMuted)),
                Text(
                  first.isNotEmpty ? first : 'Utilisateur',
                  style: TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w700, letterSpacing: -0.3),
                ),
              ],
            ),
          ),
          // AI credits chip — always visible, taps through to /credits.
          const AiCreditsChip(),
          const SizedBox(width: 6),
          // Plan badge
          if (_quota != null)
            GestureDetector(
              onTap: () => _push(const PlanScreen()),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: _planColor(_quota!.plan).withOpacity(0.12),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: _planColor(_quota!.plan).withOpacity(0.3)),
                ),
                child: Text(
                  _quota!.plan,
                  style: TextStyle(
                      color: _planColor(_quota!.plan),
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5),
                ),
              ),
            ),
          const SizedBox(width: 10),
          // Notification button
          _IconBtn(
            icon: Icons.notifications_outlined,
            badge: true,
            onTap: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Notifications — bientôt disponible'),
                behavior: SnackBarBehavior.floating,
                duration: Duration(seconds: 2),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Color _planColor(String plan) {
    switch (plan) {
      case 'PRO':
        return AppColors.primary;
      case 'BUSINESS':
        return const Color(0xFFD97706);
      default:
        return context.appTextMuted;
    }
  }

  Widget _buildHeroCard() {
    final revenue = _stats?.revenue ?? 0;
    final growth = _stats?.revenueGrowth ?? 0;

    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 14),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF0F8F65), Color(0xFF0B6B4C)],
          ),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF0F8F65).withOpacity(0.35),
              blurRadius: 24,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Encaissé ce mois-ci',
                style: TextStyle(color: Colors.white70, fontSize: 12.5)),
            const SizedBox(height: 6),
            AnimatedCounter(
              value: revenue,
              formatter: _fmtXOF,
              style: TextStyle(
                color: Colors.white,
                fontSize: 30,
                fontWeight: FontWeight.w800,
                letterSpacing: -1,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: growth >= 0
                        ? Colors.white.withOpacity(0.2)
                        : Colors.red.withOpacity(0.3),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        growth >= 0 ? Icons.trending_up_rounded : Icons.trending_down_rounded,
                        color: Colors.white,
                        size: 13,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${growth >= 0 ? '+' : ''}$growth %',
                        style: TextStyle(
                            color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Text('vs. mois dernier',
                    style: TextStyle(color: Colors.white60, fontSize: 12)),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                    child: _HeroStat(
                        label: 'Devis ce mois',
                        value: '${_stats?.totalQuotes ?? 0}')),
                const SizedBox(width: 8),
                Expanded(
                    child: _HeroStat(
                        label: 'En attente',
                        value: _fmtXOF(_stats?.pending ?? 0))),
                const SizedBox(width: 8),
                Expanded(
                    child: _HeroStat(
                        label: 'En retard',
                        value: '${_stats?.overdueCount ?? 0}')),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatRow() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 14),
      child: Row(
        children: [
          Expanded(
            child: _StatCard(
              label: 'Clients',
              value: '${_stats?.totalClients ?? 0}',
              icon: Icons.people_rounded,
              color: const Color(0xFF2563EB),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _StatCard(
              label: 'Devis payés',
              value: '${(_stats?.recentQuotes.where((q) => q.status == QuoteStatus.paid).length ?? 0)}',
              icon: Icons.check_circle_rounded,
              color: AppColors.statusPaid,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _StatCard(
              label: 'En retard',
              value: '${_stats?.overdueCount ?? 0}',
              icon: Icons.warning_amber_rounded,
              color: AppColors.statusOverdue,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuotaCard() {
    final q = _quota!;
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 14),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: context.appSurface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: context.appBorder),
        ),
        child: Column(
          children: [
            QuotaBar(used: q.used, limit: q.limit, plan: q.plan),
            if (q.plan == 'FREE') ...[
              const SizedBox(height: 12),
              GestureDetector(
                onTap: () => _push(const PlanScreen()),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF0F8F65), Color(0xFF0B6B4C)],
                    ),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.bolt_rounded, color: Colors.white, size: 16),
                      SizedBox(width: 6),
                      Text('Passer au plan Pro — 3 500 F/mois',
                          style: TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildQuickActions() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 8),
      child: Row(
        children: [
          _QuickAction(
            icon: Icons.add_rounded,
            label: 'Devis',
            color: AppColors.primary,
            onTap: () => _push(const CreateQuoteScreen()),
          ),
          const SizedBox(width: 10),
          _QuickAction(
            icon: Icons.person_add_outlined,
            label: 'Client',
            color: const Color(0xFF2563EB),
            onTap: () => widget.onSwitchTab?.call(2),
          ),
          const SizedBox(width: 10),
          _QuickAction(
            icon: Icons.send_outlined,
            label: 'Relance',
            color: const Color(0xFFD97706),
            onTap: () => widget.onSwitchTab?.call(1),
          ),
          const SizedBox(width: 10),
          _QuickAction(
            icon: Icons.star_outline_rounded,
            label: 'Plan',
            color: const Color(0xFF7C3AED),
            onTap: () => _push(const PlanScreen()),
          ),
        ],
      ),
    );
  }

  Widget _buildRecentHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 8),
      child: Row(
        children: [
          const Expanded(
            child: Text('Devis récents',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
          ),
          GestureDetector(
            onTap: () => widget.onSwitchTab?.call(1),
            child: const Row(
              children: [
                Text('Tout voir',
                    style: TextStyle(
                        color: AppColors.primary,
                        fontSize: 13,
                        fontWeight: FontWeight.w500)),
                Icon(Icons.chevron_right_rounded,
                    color: AppColors.primary, size: 18),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _push(Widget screen) {
    Navigator.push(
      context,
      PageRouteBuilder(
        pageBuilder: (_, anim, __) => screen,
        transitionsBuilder: (_, anim, __, child) => FadeTransition(
          opacity: anim,
          child: SlideTransition(
            position: Tween<Offset>(
                    begin: const Offset(0.04, 0), end: Offset.zero)
                .animate(CurvedAnimation(parent: anim, curve: Curves.easeOutCubic)),
            child: child,
          ),
        ),
        transitionDuration: const Duration(milliseconds: 280),
      ),
    );
  }
}

// ── Sub-widgets ─────────────────────────────────────────────────────────────

class _IconBtn extends StatelessWidget {
  final IconData icon;
  final bool badge;
  final VoidCallback onTap;

  const _IconBtn({required this.icon, this.badge = false, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: context.appSurface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: context.appBorder),
        ),
        child: Stack(
          children: [
            Center(child: Icon(icon, size: 20, color: context.appText)),
            if (badge)
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    shape: BoxShape.circle,
                    border: Border.all(color: context.appSurface, width: 1.5),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _HeroStat extends StatelessWidget {
  final String label;
  final String value;

  const _HeroStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.13),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(color: Colors.white60, fontSize: 10)),
          const SizedBox(height: 2),
          Text(value,
              style: TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _StatCard(
      {required this.label,
      required this.value,
      required this.icon,
      required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: context.appSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.appBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(icon, size: 17, color: color),
          ),
          const SizedBox(height: 10),
          Text(value,
              style: TextStyle(
                  fontSize: 20, fontWeight: FontWeight.w800, letterSpacing: -0.5)),
          const SizedBox(height: 2),
          Text(label,
              style: TextStyle(fontSize: 11, color: context.appTextMuted)),
        ],
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _QuickAction({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 13),
          decoration: BoxDecoration(
            color: color.withOpacity(0.08),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: color.withOpacity(0.2)),
          ),
          child: Column(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(11),
                  boxShadow: [
                    BoxShadow(
                      color: color.withOpacity(0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Icon(icon, size: 18, color: Colors.white),
              ),
              const SizedBox(height: 7),
              Text(
                label,
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  color: color.withOpacity(0.85),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuoteCard extends StatelessWidget {
  final Quote quote;
  final String Function(double) fmtXOF;
  final VoidCallback onTap;

  const _QuoteCard({required this.quote, required this.fmtXOF, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final client = quote.client;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          color: context.appSurface,
          borderRadius: BorderRadius.circular(13),
          border: Border.all(color: context.appBorder),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.03),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            AvatarWidget(
                name: client?.name ?? '?',
                color: client?.color ?? '#0F8F65',
                size: 42),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(quote.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontSize: 13.5, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 3),
                  Text(
                    '${client?.name.split(' ').first ?? ''} · ${quote.number}',
                    style: TextStyle(
                        fontSize: 11.5, color: context.appTextMuted),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(fmtXOF(quote.total),
                    style: TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w700)),
                const SizedBox(height: 5),
                StatusBadge(status: quote.status),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
