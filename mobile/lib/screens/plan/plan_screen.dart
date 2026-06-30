import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../theme.dart';
import '../../providers/auth_provider.dart';
import '../../models/quota.dart';
import '../../services/payment_service.dart';
import '../../widgets/slide_in.dart';

class PlanScreen extends StatefulWidget {
  const PlanScreen({super.key});

  @override
  State<PlanScreen> createState() => _PlanScreenState();
}

class _PlanScreenState extends State<PlanScreen> {
  Quota? _quota;
  bool _loadingQuota = true;
  String? _upgradingPlan;
  // 'monthly' or 'annual' — annual gets a 15% discount on the backend.
  String _interval = 'monthly';

  @override
  void initState() {
    super.initState();
    _loadQuota();
  }

  Future<void> _loadQuota() async {
    try {
      final q = await PaymentService.getQuota();
      if (mounted) setState(() { _quota = q; _loadingQuota = false; });
    } catch (_) {
      if (mounted) setState(() => _loadingQuota = false);
    }
  }

  Future<void> _upgrade(String plan) async {
    setState(() => _upgradingPlan = plan);
    try {
      final res = await PaymentService.upgradePlan(
        plan,
        interval: _interval,
      );
      final uri = Uri.parse(res.paymentUrl);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Erreur lors du paiement. Réessayez.')),
        );
      }
    } finally {
      if (mounted) setState(() => _upgradingPlan = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentPlan = context.watch<AuthProvider>().user?.plan ?? 'FREE';

    return Scaffold(
      backgroundColor: context.appBg,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
                child: Row(
                  children: [
                    IconButton(
                      icon: Icon(Icons.arrow_back_ios_new_rounded, size: 18),
                      onPressed: () => Navigator.pop(context),
                    ),
                    const Expanded(
                      child: Text('Plans & Tarifs',
                          style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                              letterSpacing: -0.5)),
                    ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: SlideIn(
                delay: const Duration(milliseconds: 80),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 20, 18, 0),
                  child: Column(
                    children: [
                      _buildHeaderBanner(currentPlan),
                      const SizedBox(height: 16),
                      _IntervalToggle(
                        value: _interval,
                        onChanged: (v) => setState(() => _interval = v),
                      ),
                      const SizedBox(height: 16),
                      _PlanCard(
                        name: 'FREE',
                        monthlyPrice: 0,
                        interval: _interval,
                        tagline: 'Pour démarrer',
                        color: context.appTextMuted,
                        isCurrent: currentPlan == 'FREE',
                        features: const [
                          _Feature('5 devis par mois', true),
                          _Feature('10 crédits IA à l\'inscription', true),
                          _Feature('Gestion clients & catalogue produits', true),
                          _Feature('Export PDF — filigrane NexaPay', true),
                          _Feature('Partage WhatsApp', true),
                            _Feature('Lien de paiement MoMo + carte', false),
                          _Feature('Crédits IA mensuels', false),
                        ],
                        onUpgrade: null,
                        loading: false,
                      ),
                      const SizedBox(height: 12),
                      SlideIn(
                        delay: const Duration(milliseconds: 160),
                        child: _PlanCard(
                          name: 'PRO',
                          monthlyPrice: 3500,
                          interval: _interval,
                          tagline: 'Pour les freelances actifs',
                          color: AppColors.primary,
                          isCurrent: currentPlan == 'PRO',
                          popular: true,
                          features: const [
                            _Feature('30 devis par mois', true),
                            _Feature('80 crédits IA inclus / mois', true),
                            _Feature('PDF sans filigrane', true),
                            _Feature('Lien de paiement MoMo + carte', true),
                            _Feature('Suivi des paiements temps réel', true),
                            _Feature('Reversement MoMo automatique (97 %)', true),
                          ],
                          onUpgrade: currentPlan == 'PRO' || currentPlan == 'BUSINESS'
                              ? null
                              : () => _upgrade('PRO'),
                          loading: _upgradingPlan == 'PRO',
                        ),
                      ),
                      const SizedBox(height: 12),
                      SlideIn(
                        delay: const Duration(milliseconds: 240),
                        child: _PlanCard(
                          name: 'BUSINESS',
                          monthlyPrice: 9000,
                          interval: _interval,
                          tagline: 'Pour les PME',
                          color: const Color(0xFFB45309),
                          isCurrent: currentPlan == 'BUSINESS',
                          features: const [
                            _Feature('Devis illimités', true),
                            _Feature('200 crédits IA inclus / mois', true),
                            _Feature('PDF sans filigrane', true),
                            _Feature('Lien de paiement MoMo + carte', true),
                            _Feature('Reversement MoMo automatique (97 %)', true),
                            _Feature('Multi-collaborateurs (bientôt)', true),
                          ],
                          onUpgrade: currentPlan == 'BUSINESS'
                              ? null
                              : () => _upgrade('BUSINESS'),
                          loading: _upgradingPlan == 'BUSINESS',
                        ),
                      ),
                      const SizedBox(height: 16),
                      SlideIn(
                        delay: const Duration(milliseconds: 300),
                        child: _BuyCreditsCard(),
                      ),
                      const SizedBox(height: 16),
                      SlideIn(
                        delay: const Duration(milliseconds: 360),
                        child: _CommissionBanner(),
                      ),
                      const SizedBox(height: 32),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeaderBanner(String plan) {
    if (_loadingQuota) {
      return Container(
        height: 72,
        decoration: BoxDecoration(
          color: context.appSurface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: context.appBorder),
        ),
        child: const Center(child: CircularProgressIndicator(color: AppColors.primary)),
      );
    }

    if (_quota == null) return const SizedBox.shrink();

    final ratio = _quota!.ratio;
    final used = _quota!.used;
    final limit = _quota!.limit;

    Color barColor = AppColors.primary;
    if (ratio >= 0.9) {
      barColor = AppColors.statusOverdue;
    } else if (ratio >= 0.7) {
      barColor = Colors.amber.shade700;
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: context.appSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.appBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Utilisation ce mois',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              const Spacer(),
              Text('$used / ${limit == 9999 ? '∞' : '$limit'} devis',
                  style: TextStyle(
                      fontSize: 12,
                      color: barColor,
                      fontWeight: FontWeight.w600)),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: limit == 9999 ? 0.0 : ratio),
              duration: const Duration(milliseconds: 900),
              curve: Curves.easeOutCubic,
              builder: (_, v, __) => LinearProgressIndicator(
                value: v,
                backgroundColor: context.appBorder,
                valueColor: AlwaysStoppedAnimation(barColor),
                minHeight: 7,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Feature {
  final String text;
  final bool included;
  const _Feature(this.text, this.included);
}

class _PlanCard extends StatelessWidget {
  final String name;
  /// The plan's monthly list price — annual is computed from this with the
  /// same 15% discount as the backend (`ANNUAL_DISCOUNT`).
  final int monthlyPrice;
  /// 'monthly' or 'annual' — controls which price is shown on the card.
  final String interval;
  final String tagline;
  final Color color;
  final bool isCurrent;
  final bool popular;
  final List<_Feature> features;
  final VoidCallback? onUpgrade;
  final bool loading;

  static const double _annualDiscount = 0.15;

  const _PlanCard({
    required this.name,
    required this.monthlyPrice,
    required this.interval,
    required this.tagline,
    required this.color,
    required this.isCurrent,
    this.popular = false,
    required this.features,
    required this.onUpgrade,
    required this.loading,
  });

  int get _displayPrice {
    if (monthlyPrice == 0) return 0;
    return interval == 'annual'
        ? (monthlyPrice * (1 - _annualDiscount)).round()
        : monthlyPrice;
  }

  int get _annualTotal => (monthlyPrice * 12 * (1 - _annualDiscount)).round();

  @override
  Widget build(BuildContext context) {
    final borderColor = isCurrent ? color : context.appBorder;
    // Theme-aware tinted background: blends the plan color over the current
    // surface so the card stays readable in BOTH light and dark mode. (The
    // previous version hardcoded light pastel backgrounds, which made
    // `context.appText` invisible in dark mode.)
    final activeBg =
        Color.alphaBlend(color.withOpacity(0.12), context.appSurface);

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      decoration: BoxDecoration(
        color: isCurrent ? activeBg : context.appSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderColor, width: isCurrent ? 2 : 1),
        boxShadow: isCurrent
            ? [BoxShadow(color: color.withOpacity(0.12), blurRadius: 12, offset: const Offset(0, 4))]
            : [],
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(name,
                              style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                  color: color,
                                  letterSpacing: 0.5)),
                          if (popular) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: color,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text('Populaire',
                                  style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700)),
                            ),
                          ],
                          if (isCurrent) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: color.withOpacity(0.15),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text('Actif',
                                  style: TextStyle(
                                      color: color,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700)),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(tagline,
                          style: TextStyle(
                              fontSize: 12, color: context.appTextMuted)),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      monthlyPrice == 0
                          ? 'Gratuit'
                          : _fmtXOF(_displayPrice.toDouble()),
                      style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: monthlyPrice == 0
                              ? context.appTextMuted
                              : color),
                    ),
                    if (monthlyPrice > 0)
                      Text('/ mois',
                          style: TextStyle(
                              fontSize: 11, color: context.appTextMuted)),
                    if (monthlyPrice > 0 && interval == 'annual')
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          '${_fmtXOF(_annualTotal.toDouble())} / an',
                          style: TextStyle(
                            fontSize: 10.5,
                            color: color,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Divider(height: 1),
            const SizedBox(height: 14),
            ...features.map((f) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Icon(
                    f.included ? Icons.check_circle_rounded : Icons.cancel_rounded,
                    size: 16,
                    color: f.included ? color : context.appBorder,
                  ),
                  const SizedBox(width: 10),
                  Text(f.text,
                      style: TextStyle(
                          fontSize: 13,
                          color: f.included ? context.appText : context.appTextMuted)),
                ],
              ),
            )),
            if (onUpgrade != null) ...[
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: loading ? null : onUpgrade,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: color,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(vertical: 13),
                  ),
                  child: loading
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2))
                      : Text('Passer au plan $name',
                          style: TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 14)),
                ),
              ),
            ],
            if (isCurrent && onUpgrade == null && monthlyPrice > 0) ...[
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: null,
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(color: color.withOpacity(0.4)),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(vertical: 13),
                  ),
                  child: Text('Plan actuel',
                      style: TextStyle(
                          color: color,
                          fontWeight: FontWeight.w600,
                          fontSize: 14)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  static String _fmtXOF(double n) {
    final s = n.toStringAsFixed(0);
    final buf = StringBuffer();
    int count = 0;
    for (int i = s.length - 1; i >= 0; i--) {
      if (count > 0 && count % 3 == 0) buf.write(' ');
      buf.write(s[i]);
      count++;
    }
    return '${buf.toString().split('').reversed.join()} F CFA';
  }
}

/// Pill toggle Mensuel / Annuel (with `-15%` badge on the annual side).
class _IntervalToggle extends StatelessWidget {
  final String value;
  final ValueChanged<String> onChanged;

  const _IntervalToggle({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: context.appSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: context.appBorder),
      ),
      child: Row(
        children: [
          _TogglePart(
            label: 'Mensuel',
            active: value == 'monthly',
            onTap: () => onChanged('monthly'),
          ),
          _TogglePart(
            label: 'Annuel',
            active: value == 'annual',
            onTap: () => onChanged('annual'),
            trailing: const Padding(
              padding: EdgeInsets.only(left: 6),
              child: _DiscountBadge(),
            ),
          ),
        ],
      ),
    );
  }
}

class _TogglePart extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;
  final Widget? trailing;
  const _TogglePart({
    required this.label,
    required this.active,
    required this.onTap,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        borderRadius: BorderRadius.circular(9),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            color: active ? AppColors.primary : Colors.transparent,
            borderRadius: BorderRadius.circular(9),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                  color: active ? Colors.white : context.appTextMuted,
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
        ),
      ),
    );
  }
}

class _DiscountBadge extends StatelessWidget {
  const _DiscountBadge();
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.2),
        borderRadius: BorderRadius.circular(20),
      ),
      child: const Text('-15 %',
          style: TextStyle(
              fontSize: 10, fontWeight: FontWeight.w800, color: Colors.white)),
    );
  }
}

/// CTA card to reach the AI credits screen — also handles the case where the
/// user wants extra credits without switching plans.
class _BuyCreditsCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Material(
      color: context.appSurface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => Navigator.of(context).pushNamed('/credits'),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: context.appBorder),
          ),
          child: Row(
            children: [
              Container(
                width: 42, height: 42,
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.auto_awesome_rounded,
                    color: AppColors.primary),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Acheter des crédits IA',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: context.appText,
                        )),
                    const SizedBox(height: 2),
                    Text(
                      '10 / 30 / 100 crédits à la demande, sans changer de plan',
                      style: TextStyle(
                          fontSize: 12, color: context.appTextMuted),
                    ),
                  ],
                ),
              ),
              Icon(Icons.arrow_forward_ios_rounded,
                  size: 14, color: context.appTextMuted),
            ],
          ),
        ),
      ),
    );
  }
}

class _CommissionBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    // Same theme-aware blend used by active plan cards — keeps the green
    // "you only pay when paid" framing in light mode AND stays readable in
    // dark mode (the previous hardcoded `#F0FDF4` made all text invisible).
    final bg =
        Color.alphaBlend(AppColors.primary.withOpacity(0.10), context.appSurface);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.primary.withOpacity(0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(Icons.account_balance_wallet_outlined,
                size: 20, color: AppColors.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Commission sur encaissement',
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: context.appText)),
                const SizedBox(height: 4),
                Text(
                  '3% sur chaque paiement collecté via lien MoMo ou carte bancaire. Payé uniquement quand vous êtes payé.',
                  style: TextStyle(
                      fontSize: 12,
                      color: context.appTextMuted,
                      height: 1.5),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
