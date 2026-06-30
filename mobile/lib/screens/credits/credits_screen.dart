import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../models/credits.dart';
import '../../providers/credits_provider.dart';
import '../../services/credits_service.dart';
import '../../theme.dart';

/// Screen mirroring the React `Pricing` credit-pack section :
/// shows the balance + monthly quota and lets the user buy more packs.
class CreditsScreen extends StatefulWidget {
  const CreditsScreen({super.key});

  @override
  State<CreditsScreen> createState() => _CreditsScreenState();
}

class _CreditsScreenState extends State<CreditsScreen> {
  String? _purchasingPackId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance
        .addPostFrameCallback((_) => context.read<CreditsProvider>().refresh());
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

  Future<void> _buy(CreditPack pack) async {
    setState(() => _purchasingPackId = pack.id);
    try {
      final result = await CreditsService.purchase(pack.id);
      final uri = Uri.parse(result.paymentUrl);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Finalisez le paiement de ${pack.credits} crédits.'),
          ));
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur : $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _purchasingPackId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final credits = context.watch<CreditsProvider>();

    return Scaffold(
      backgroundColor: context.appBg,
      appBar: AppBar(
        title: const Text('Crédits IA'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () => context.read<CreditsProvider>().refresh(),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 32),
          children: [
            _BalanceCard(balance: credits.balance, loading: credits.loading),
            const SizedBox(height: 20),
            Text(
              'Acheter des crédits supplémentaires',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: context.appText,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              "Utilisables sur n'importe quel plan · 1 crédit = 1 action IA",
              style: TextStyle(
                fontSize: 12.5,
                color: context.appTextMuted,
              ),
            ),
            const SizedBox(height: 14),
            if (credits.packs.isEmpty && !credits.loading)
              _DefaultPacks(onBuy: _buy, purchasingId: _purchasingPackId)
            else
              ...credits.packs.map(
                (p) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _PackCard(
                    pack: p,
                    fmtXOF: _fmtXOF,
                    buying: _purchasingPackId == p.id,
                    onTap: () => _buy(p),
                  ),
                ),
              ),
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: context.appSurface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: context.appBorder),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline_rounded,
                      size: 16, color: context.appTextMuted),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      "Les crédits IA permettent de générer des devis "
                      "automatiquement, suggérer des prix et améliorer vos "
                      "descriptions. Si un appel IA échoue, votre crédit est "
                      "automatiquement remboursé.",
                      style: TextStyle(
                        fontSize: 12,
                        height: 1.5,
                        color: context.appTextMuted,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BalanceCard extends StatelessWidget {
  final CreditBalance? balance;
  final bool loading;

  const _BalanceCard({required this.balance, required this.loading});

  @override
  Widget build(BuildContext context) {
    final aiCredits = balance?.aiCredits ?? 0;
    final monthlyQuota = balance?.monthlyQuota ?? 0;
    final plan = balance?.plan ?? 'FREE';
    final low = aiCredits < 5;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: low
              ? [const Color(0xFFFEF3C7), const Color(0xFFFCD34D)]
              : [AppColors.primary, AppColors.primaryDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.auto_awesome_rounded,
                  color: Colors.white, size: 20),
              const SizedBox(width: 8),
              Text(
                'Crédits IA',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                  color: low
                      ? const Color(0xFF92400E)
                      : Colors.white.withOpacity(0.9),
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  plan,
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: low ? const Color(0xFF92400E) : Colors.white,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (loading && balance == null)
            const SizedBox(
              height: 20, width: 20,
              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
            )
          else
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '$aiCredits',
                  style: TextStyle(
                    fontSize: 40,
                    height: 1,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -1.5,
                    color: low ? const Color(0xFF92400E) : Colors.white,
                  ),
                ),
                const SizedBox(width: 8),
                if (monthlyQuota > 0)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text(
                      '/ $monthlyQuota/mois',
                      style: TextStyle(
                        fontSize: 13,
                        color: low
                            ? const Color(0xFF92400E)
                            : Colors.white.withOpacity(0.85),
                      ),
                    ),
                  ),
              ],
            ),
          const SizedBox(height: 6),
          Text(
            low
                ? 'Solde bas — pensez à recharger.'
                : 'Disponibles immédiatement pour vos actions IA.',
            style: TextStyle(
              fontSize: 12.5,
              color: low
                  ? const Color(0xFF92400E)
                  : Colors.white.withOpacity(0.9),
            ),
          ),
        ],
      ),
    );
  }
}

class _PackCard extends StatelessWidget {
  final CreditPack pack;
  final String Function(num) fmtXOF;
  final bool buying;
  final VoidCallback onTap;

  const _PackCard({
    required this.pack,
    required this.fmtXOF,
    required this.buying,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final pricePerCredit = (pack.price / pack.credits).round();
    return Material(
      color: context.appSurface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: buying ? null : onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: context.appBorder),
          ),
          child: Row(
            children: [
              Container(
                width: 44, height: 44,
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.auto_awesome_rounded,
                    size: 22, color: AppColors.primary),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${pack.credits} crédits',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: context.appText,
                        )),
                    const SizedBox(height: 2),
                    Text('${fmtXOF(pricePerCredit)} / crédit',
                        style: TextStyle(
                          fontSize: 12,
                          color: context.appTextMuted,
                        )),
                  ],
                ),
              ),
              if (buying)
                const SizedBox(
                  width: 22, height: 22,
                  child: CircularProgressIndicator(
                      color: AppColors.primary, strokeWidth: 2.5),
                )
              else
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(fmtXOF(pack.price),
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: AppColors.primary,
                        )),
                    const SizedBox(height: 2),
                    Text('Acheter',
                        style: TextStyle(
                          fontSize: 11.5,
                          color: context.appTextMuted,
                        )),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DefaultPacks extends StatelessWidget {
  final Future<void> Function(CreditPack) onBuy;
  final String? purchasingId;

  const _DefaultPacks({required this.onBuy, required this.purchasingId});

  @override
  Widget build(BuildContext context) {
    // Same defaults as backend `CREDIT_PACKS` so the UI still works while the
    // balance API call is in flight or fails.
    const defaults = <CreditPack>[
      CreditPack(id: 'pack_10', credits: 10, price: 1500, label: '10 crédits'),
      CreditPack(id: 'pack_30', credits: 30, price: 3500, label: '30 crédits'),
      CreditPack(id: 'pack_100', credits: 100, price: 9000, label: '100 crédits'),
    ];
    String fmt(num n) {
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

    return Column(
      children: defaults
          .map((p) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _PackCard(
                  pack: p,
                  fmtXOF: fmt,
                  buying: purchasingId == p.id,
                  onTap: () => onBuy(p),
                ),
              ))
          .toList(),
    );
  }
}
