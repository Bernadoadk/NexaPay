import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../theme.dart';
import '../../models/payout.dart';
import '../../providers/auth_provider.dart';
import '../../services/payment_service.dart';

/// "Mes reversements" — Flutter port of the React `Payouts.tsx` screen.
/// Lists every payout made to the user's MoMo after a quote payment landed.
class PayoutsScreen extends StatefulWidget {
  const PayoutsScreen({super.key});

  @override
  State<PayoutsScreen> createState() => _PayoutsScreenState();
}

class _PayoutsScreenState extends State<PayoutsScreen> {
  List<Payout> _payouts = [];
  bool _loading = true;
  String? _retryingId;
  ({String kind, String msg})? _feedback;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _payouts = await PaymentService.getPayouts();
    } catch (_) {
      // Empty list is the safest fallback so the empty-state UI shows.
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _retry(Payout p) async {
    setState(() => _retryingId = p.id);
    try {
      await PaymentService.retryPayout(p.id);
      _setFeedback('ok', 'Reversement renvoyé avec succès.');
    } catch (e) {
      _setFeedback('err', e.toString().replaceAll('Exception:', '').trim());
    } finally {
      if (mounted) setState(() => _retryingId = null);
      await _load();
    }
  }

  void _setFeedback(String kind, String msg) {
    if (!mounted) return;
    setState(() => _feedback = (kind: kind, msg: msg));
    Future.delayed(const Duration(seconds: 4), () {
      if (mounted) setState(() => _feedback = null);
    });
  }

  String _fmtXOF(num n) {
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
    final noMomo = user?.needsMomoSetup ?? true;

    // Aggregate stats over completed transfers only — matches the React UI.
    int totalReceived = 0;
    int totalNet = 0;
    int totalCommission = 0;
    int pending = 0;
    int failed = 0;
    for (final p in _payouts) {
      if (p.status == PayoutStatus.transferred) {
        totalReceived += p.grossAmount.round();
        totalNet += p.netAmount.round();
        totalCommission += p.commission.round();
      }
      if (p.isPending) pending++;
      if (p.isFailed) failed++;
    }

    return Scaffold(
      backgroundColor: context.appBg,
      appBar: AppBar(
        title: const Text('Mes reversements'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
          children: [
            Text(
              'Argent reçu de vos clients via lien de paiement et reversé '
              'sur votre Mobile Money. Commission NexaPay : 3 %.',
              style: TextStyle(
                fontSize: 12.5,
                color: context.appTextMuted,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 14),

            if (noMomo) _NoMomoBlock(),
            if (_feedback != null) _FeedbackBanner(feedback: _feedback!),

            // Stats grid
            _StatsGrid(
              totalNet: _fmtXOF(totalNet),
              totalReceived: _fmtXOF(totalReceived),
              totalCommission: _fmtXOF(totalCommission),
              pending: pending,
              failed: failed,
            ),
            const SizedBox(height: 16),

            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: Center(
                  child: CircularProgressIndicator(color: AppColors.primary),
                ),
              )
            else if (_payouts.isEmpty)
              _EmptyState()
            else
              ..._payouts.map((p) => _PayoutTile(
                    payout: p,
                    fmtXOF: _fmtXOF,
                    retrying: _retryingId == p.id,
                    onRetry: () => _retry(p),
                  )),
            const SizedBox(height: 20),
            _HowItWorks(),
          ],
        ),
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-widgets
// ──────────────────────────────────────────────────────────────────────────────

class _NoMomoBlock extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF3C7),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFCD34D)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.warning_amber_rounded,
              color: Color(0xFF92400E), size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Aucun numéro MoMo enregistré',
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF92400E),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Les paiements de vos clients arriveront chez nous mais ne '
                  'pourront pas vous être reversés tant que votre numéro '
                  'n’est pas configuré.',
                  style: TextStyle(
                    fontSize: 12,
                    color: const Color(0xFF92400E).withOpacity(0.85),
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 10),
                Align(
                  alignment: Alignment.centerLeft,
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.pop(context);
                      // Settings is reachable from the bottom nav — popping
                      // back lets the user tap "Réglages" themselves; we'd
                      // need a router to deep-link directly.
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF92400E),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 9),
                      minimumSize: Size.zero,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                      textStyle: const TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w700),
                    ),
                    child: const Text('Configurer maintenant'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FeedbackBanner extends StatelessWidget {
  final ({String kind, String msg}) feedback;
  const _FeedbackBanner({required this.feedback});

  @override
  Widget build(BuildContext context) {
    final isOk = feedback.kind == 'ok';
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isOk ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isOk ? const Color(0xFF86EFAC) : const Color(0xFFFCA5A5),
        ),
      ),
      child: Row(
        children: [
          Icon(
            isOk ? Icons.check_circle_rounded : Icons.error_outline_rounded,
            size: 18,
            color:
                isOk ? const Color(0xFF14532D) : const Color(0xFF7F1D1D),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              feedback.msg,
              style: TextStyle(
                fontSize: 12.5,
                color:
                    isOk ? const Color(0xFF14532D) : const Color(0xFF7F1D1D),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatsGrid extends StatelessWidget {
  final String totalNet;
  final String totalReceived;
  final String totalCommission;
  final int pending;
  final int failed;

  const _StatsGrid({
    required this.totalNet,
    required this.totalReceived,
    required this.totalCommission,
    required this.pending,
    required this.failed,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _StatCard(
                label: 'Reversé sur MoMo',
                value: totalNet,
                hint: 'net après commission',
                mono: true,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _StatCard(
                label: 'Encaissé total',
                value: totalReceived,
                hint: 'brut',
                mono: true,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: _StatCard(
                label: 'Commission NexaPay',
                value: totalCommission,
                hint: '3 % sur encaissés',
                mono: true,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _StatCard(
                label: 'En attente · Échec',
                value: '$pending · $failed',
                hint:
                    failed > 0 ? 'à relancer manuellement' : 'rien à faire',
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final String? hint;
  final bool mono;
  const _StatCard({
    required this.label,
    required this.value,
    this.hint,
    this.mono = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: context.appSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: context.appBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 9.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
              color: context.appTextMuted,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              fontFamily: mono ? 'monospace' : null,
              color: context.appText,
            ),
          ),
          if (hint != null) ...[
            const SizedBox(height: 2),
            Text(
              hint!,
              style: TextStyle(fontSize: 10.5, color: context.appTextSubtle),
            ),
          ],
        ],
      ),
    );
  }
}

class _PayoutTile extends StatelessWidget {
  final Payout payout;
  final String Function(num) fmtXOF;
  final bool retrying;
  final VoidCallback onRetry;

  const _PayoutTile({
    required this.payout,
    required this.fmtXOF,
    required this.retrying,
    required this.onRetry,
  });

  ({Color bg, Color text, Color dot}) _statusColors() {
    switch (payout.status) {
      case PayoutStatus.transferred:
        return (
          bg: const Color(0xFFE6F4EE),
          text: const Color(0xFF0C7A56),
          dot: const Color(0xFF0F8F65),
        );
      case PayoutStatus.failed:
        return (
          bg: const Color(0xFFF8E5E5),
          text: const Color(0xFFB43A3A),
          dot: const Color(0xFFB43A3A),
        );
      case PayoutStatus.transferring:
        return (
          bg: const Color(0xFFFBEFDF),
          text: const Color(0xFFA1530F),
          dot: const Color(0xFFC2691B),
        );
      case PayoutStatus.pending:
        return (
          bg: const Color(0xFFF5F4EE),
          text: const Color(0xFF6B7570),
          dot: const Color(0xFF97A09B),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = _statusColors();
    final date = payout.transferredAt ??
        payout.quote?.paidAt ??
        payout.createdAt;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: context.appSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.appBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      payout.quote?.title ?? 'Devis supprimé',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: context.appText,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      payout.quote?.number ?? '—',
                      style: TextStyle(
                        fontSize: 11,
                        fontFamily: 'monospace',
                        color: context.appTextMuted,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: c.bg,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6, height: 6,
                      decoration: BoxDecoration(
                        color: c.dot,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      payoutStatusLabel(payout.status),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: c.text,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Reversé sur MoMo',
                  style: TextStyle(
                    fontSize: 11.5,
                    color: context.appTextMuted,
                  ),
                ),
              ),
              Text(
                fmtXOF(payout.netAmount),
                style: const TextStyle(
                  fontSize: 16,
                  fontFamily: 'monospace',
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0C7A56),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  'Encaissé ${fmtXOF(payout.grossAmount)} · '
                  'commission ${fmtXOF(payout.commission)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11,
                    color: context.appTextMuted,
                  ),
                ),
              ),
              Text(
                DateFormat('dd/MM/yyyy').format(date),
                style: TextStyle(
                  fontSize: 11,
                  color: context.appTextMuted,
                ),
              ),
            ],
          ),
          if (payout.isFailed && payout.failReason != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFFEE2E2),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFFCA5A5)),
              ),
              child: Text(
                'Détail Fedapay : ${payout.failReason}',
                style: const TextStyle(
                  fontSize: 11.5,
                  color: Color(0xFF7F1D1D),
                ),
              ),
            ),
          ],
          if (payout.isFailed) ...[
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton.icon(
                onPressed: retrying ? null : onRetry,
                icon: retrying
                    ? const SizedBox(
                        width: 14, height: 14,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: AppColors.primary),
                      )
                    : const Icon(Icons.refresh_rounded, size: 16),
                label: Text(retrying ? 'Renvoi…' : 'Relancer le reversement'),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppColors.primary),
                  foregroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 8),
                  minimumSize: Size.zero,
                  textStyle: const TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w700),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: context.appSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: context.appBorder,
          style: BorderStyle.solid,
        ),
      ),
      child: Column(
        children: [
          Icon(Icons.account_balance_wallet_outlined,
              size: 36, color: context.appTextMuted),
          const SizedBox(height: 12),
          Text(
            'Aucun reversement pour le moment',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: context.appText,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Dès qu’un client paiera un devis via votre lien MoMo / carte, '
            'vous verrez le reversement ici.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              color: context.appTextMuted,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }
}

class _HowItWorks extends StatefulWidget {
  @override
  State<_HowItWorks> createState() => _HowItWorksState();
}

class _HowItWorksState extends State<_HowItWorks> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: context.appSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.appBorder),
      ),
      child: Column(
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: () => setState(() => _expanded = !_expanded),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Comment fonctionne le reversement ?',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: context.appText,
                      ),
                    ),
                  ),
                  Icon(
                    _expanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    color: context.appTextMuted,
                  ),
                ],
              ),
            ),
          ),
          if (_expanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Text(
                '1. Votre client paie le devis via votre lien MoMo / carte. '
                'L’argent atterrit dans le compte '
                'sécurisé NexaPay (Fedapay).\n\n'
                '2. Immédiatement après, NexaPay prélève sa commission de '
                '3 % et déclenche un transfert du net (97 %) vers votre '
                'numéro MoMo enregistré.\n\n'
                '3. Vous recevez l’argent sur votre MoMo en quelques '
                'secondes. Le statut passe en Reversé sur cette page.\n\n'
                '4. En cas d’échec (numéro invalide, opérateur HS…), le '
                'statut passe en Échec. Votre argent reste sécurisé chez '
                'nous tant que vous ne relancez pas avec succès.',
                style: TextStyle(
                  fontSize: 12,
                  color: context.appTextMuted,
                  height: 1.6,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
