import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../theme.dart';
import '../../models/quote.dart';
import '../../providers/auth_provider.dart';
import '../../services/quote_service.dart';
import '../../services/quote_template_service.dart';
import '../../services/payment_service.dart';
import '../../widgets/avatar_widget.dart';
import '../../widgets/status_badge.dart';
import '../../widgets/slide_in.dart';
import '../../widgets/template_selector_sheet.dart';

class QuoteDetailScreen extends StatefulWidget {
  final String quoteId;

  const QuoteDetailScreen({super.key, required this.quoteId});

  @override
  State<QuoteDetailScreen> createState() => _QuoteDetailScreenState();
}

class _QuoteDetailScreenState extends State<QuoteDetailScreen> {
  Quote? _quote;
  bool _loading = true;
  bool _paymentLoading = false;
  bool _checkingPayment = false;
  bool _syncingInBackground = false;
  Timer? _autoSyncTimer;

  @override
  void initState() {
    super.initState();
    _loadQuote();
  }

  @override
  void dispose() {
    _autoSyncTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadQuote() async {
    try {
      final q = await QuoteService.getById(widget.quoteId);
      if (mounted) {
        setState(() => _quote = q);
        _scheduleAutoSync();
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// While a payment link is waiting for the client, poll Fedapay via our
  /// backend so the quote auto-flips to PAID without the user lifting a finger.
  void _scheduleAutoSync() {
    _autoSyncTimer?.cancel();
    final q = _quote;
    if (q == null || !q.isAwaitingPayment) return;
    _autoSyncTimer =
        Timer.periodic(const Duration(seconds: 6), (_) => _silentSync());
  }

  Future<void> _silentSync() async {
    if (_syncingInBackground) return;
    _syncingInBackground = true;
    try {
      final changed = await PaymentService.checkQuotePayment(widget.quoteId);
      if (changed && mounted) {
        // Refresh full quote so the side panel + status badge update.
        final q = await QuoteService.getById(widget.quoteId);
        if (mounted) setState(() => _quote = q);
        _autoSyncTimer?.cancel();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Paiement reçu — devis marqué comme payé.'),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    } catch (_) {
      // Silent — the next tick will retry.
    } finally {
      _syncingInBackground = false;
    }
  }

  Future<void> _manualCheck() async {
    if (_checkingPayment) return;
    setState(() => _checkingPayment = true);
    try {
      final changed = await PaymentService.checkQuotePayment(widget.quoteId);
      if (changed) {
        final q = await QuoteService.getById(widget.quoteId);
        if (mounted) setState(() => _quote = q);
        _autoSyncTimer?.cancel();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Paiement confirmé !'),
              backgroundColor: AppColors.primary,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text(
                  'Toujours en attente — votre client n’a pas encore payé.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur de vérification : $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _checkingPayment = false);
    }
  }

  String _fmtXOF(double n) {
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

  String _fmtDate(DateTime? d) {
    if (d == null) return '—';
    const months = [
      'jan.',
      'fév.',
      'mars',
      'avr.',
      'mai',
      'juin',
      'juil.',
      'août',
      'sept.',
      'oct.',
      'nov.',
      'déc.'
    ];
    return '${d.day.toString().padLeft(2, '0')} ${months[d.month - 1]} ${d.year}';
  }

  Future<void> _shareWhatsApp() async {
    final q = _quote;
    if (q == null) return;
    final clientName = q.client?.name ?? 'Client';
    final text = Uri.encodeComponent(
      'Bonjour $clientName,\n\nVeuillez trouver ci-joint votre devis ${q.number}.\n\n'
      '📋 *${q.title}*\n'
      '💰 Total : *${_fmtXOF(q.total)} CFA*\n'
      '📅 Valable ${q.validDays} jours\n\n'
      'Merci de votre confiance.',
    );
    final uri = Uri.parse('https://wa.me/?text=$text');
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  Future<void> _generatePaymentLink() async {
    setState(() => _paymentLoading = true);
    try {
      final res = await PaymentService.initiatePayment(widget.quoteId);
      if (!mounted) return;
      // Prefer the user-shareable URL (`/pay/<id>` on the freelancer's domain)
      // when present; fall back to the raw Fedapay checkout URL otherwise.
      final shareable = res.shareUrl.isNotEmpty ? res.shareUrl : res.paymentUrl;
      _showPaymentLinkSheet(shareable);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content:
                  Text('Erreur lors de la génération du lien de paiement')),
        );
      }
    } finally {
      if (mounted) setState(() => _paymentLoading = false);
    }
  }

  void _showPaymentLinkSheet(String url) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                    color: context.appBorder,
                    borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 20),
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: AppColors.primarySoft,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(Icons.account_balance_wallet_outlined,
                  size: 28, color: AppColors.primary),
            ),
            const SizedBox(height: 14),
            Text('Lien de paiement généré',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text(
              'Partagez ce lien avec votre client pour collecter le paiement via Mobile Money ou carte bancaire.',
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 13, color: context.appTextMuted, height: 1.5),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: context.appBg,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: context.appBorder),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(url,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            fontSize: 12, color: context.appTextMuted)),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () {
                      Clipboard.setData(ClipboardData(text: url));
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                            content: Text('Lien copié'),
                            backgroundColor: AppColors.primary),
                      );
                    },
                    child: Icon(Icons.copy_rounded,
                        size: 18, color: AppColors.primary),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      final text = Uri.encodeComponent(
                          'Voici votre lien de paiement : $url');
                      final uri = Uri.parse('https://wa.me/?text=$text');
                      if (await canLaunchUrl(uri)) await launchUrl(uri);
                    },
                    icon: Icon(Icons.chat_outlined, size: 16),
                    label: Text('WhatsApp'),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () async {
                      final uri = Uri.parse(url);
                      if (await canLaunchUrl(uri)) {
                        await launchUrl(uri,
                            mode: LaunchMode.externalApplication);
                      }
                    },
                    icon: Icon(Icons.open_in_new_rounded, size: 16),
                    label: Text('Ouvrir'),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showStatusMenu() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                    color: context.appBorder,
                    borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: const Align(
                alignment: Alignment.centerLeft,
                child: Text('Changer le statut',
                    style:
                        TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              ),
            ),
            const SizedBox(height: 8),
            _statusOption(Icons.send_rounded, 'Envoyer par e-mail',
                const Color(0xFF2563EB), () {
              Navigator.pop(context);
              final q = _quote;
              if (q != null) _showSendTemplateSelector(q);
            }),
            _statusOption(
                Icons.check_circle_outline_rounded,
                'Marquer comme Payé',
                AppColors.primary,
                () => _updateStatus('PAID')),
            _statusOption(Icons.warning_amber_rounded, 'Marquer en retard',
                AppColors.statusOverdue, () => _updateStatus('OVERDUE')),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Widget _statusOption(
      IconData icon, String label, Color color, VoidCallback onTap) {
    return ListTile(
      leading: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, size: 18, color: color),
      ),
      title: Text(label,
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
      onTap: onTap,
    );
  }

  void _showTemplateSelector(Quote q) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => TemplateSelectorSheet(quote: q),
    );
  }

  void _showSendTemplateSelector(Quote q) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => TemplateSelectorSheet(
        quote: q,
        mode: TemplateSelectorMode.sendEmail,
        onSent: (updated) {
          if (mounted) setState(() => _quote = updated);
        },
      ),
    );
  }

  Future<void> _saveAsTemplate(Quote q) async {
    final ctrl = TextEditingController(text: q.title);
    final name = await showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Enregistrer comme template'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Nom du template'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Annuler'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, ctrl.text.trim()),
            child: const Text('Enregistrer'),
          ),
        ],
      ),
    );
    ctrl.dispose();
    if (name == null || name.isEmpty) return;

    try {
      await QuoteTemplateService.createFromQuote(
        quoteId: q.id,
        name: name,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Template enregistré')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Impossible de créer le template')),
        );
      }
    }
  }

  Future<void> _updateStatus(String status) async {
    Navigator.pop(context);
    try {
      final updated = await QuoteService.updateStatus(widget.quoteId, status);
      if (mounted) setState(() => _quote = updated);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
          body: Center(
              child: CircularProgressIndicator(color: AppColors.primary)));
    }
    final q = _quote;
    if (q == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: Text('Devis introuvable')),
      );
    }
    final client = q.client;

    return Scaffold(
      backgroundColor: context.appBg,
      body: Column(
        children: [
          _buildTopBar(q),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SlideIn(
                    delay: const Duration(milliseconds: 0),
                    child: Row(
                      children: [
                        StatusBadge(status: q.status),
                        const Spacer(),
                        Text(
                          'Émis le ${_fmtDate(q.issuedAt ?? q.createdAt)}',
                          style: TextStyle(
                              fontSize: 12, color: context.appTextMuted),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  SlideIn(
                    delay: const Duration(milliseconds: 40),
                    child: Text(q.title,
                        style: TextStyle(
                            fontSize: 19,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.5)),
                  ),
                  const SizedBox(height: 4),
                  SlideIn(
                    delay: const Duration(milliseconds: 60),
                    child: Text(
                      'Valable ${q.validDays} jours · ${q.number}',
                      style: TextStyle(
                          fontSize: 12.5, color: context.appTextMuted),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SlideIn(
                    delay: const Duration(milliseconds: 80),
                    child: _buildTotalCard(q),
                  ),
                  const SizedBox(height: 10),
                  if (client != null)
                    SlideIn(
                      delay: const Duration(milliseconds: 120),
                      child: _buildClientCard(client),
                    ),
                  const SizedBox(height: 10),
                  SlideIn(
                    delay: const Duration(milliseconds: 160),
                    child: _buildItemsCard(q),
                  ),
                  if (q.notes != null && q.notes!.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    SlideIn(
                      delay: const Duration(milliseconds: 200),
                      child: _buildNotesCard(q.notes!),
                    ),
                  ],
                  const SizedBox(height: 10),
                  SlideIn(
                    delay: const Duration(milliseconds: 240),
                    child: _buildTimeline(q),
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
          _buildActions(q),
        ],
      ),
    );
  }

  Widget _buildTopBar(Quote q) {
    return Container(
      padding: EdgeInsets.fromLTRB(
          14, MediaQuery.of(context).padding.top + 10, 14, 10),
      decoration: BoxDecoration(
        color: context.appSurface,
        border: Border(bottom: BorderSide(color: context.appBorder)),
      ),
      child: Row(
        children: [
          IconButton(
            icon: Icon(Icons.arrow_back_ios_new_rounded, size: 18),
            onPressed: () => Navigator.pop(context),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(q.number,
                    style:
                        TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                Text(q.client?.name ?? '',
                    style:
                        TextStyle(fontSize: 11.5, color: context.appTextMuted)),
              ],
            ),
          ),
          IconButton(
            icon: Icon(Icons.more_horiz_rounded, size: 22),
            onPressed: _showStatusMenu,
          ),
        ],
      ),
    );
  }

  Widget _buildTotalCard(Quote q) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F8F65), Color(0xFF0C7A56)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('TOTAL TTC',
              style: TextStyle(
                  fontSize: 11,
                  color: Colors.white70,
                  letterSpacing: 0.8,
                  fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Text(_fmtXOF(q.total),
              style: TextStyle(
                  fontSize: 30,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                  letterSpacing: -0.5)),
          const SizedBox(height: 8),
          Row(
            children: [
              _TotalPill(
                  label: 'HT ${_fmtXOF(q.subtotal)}',
                  color: Colors.white.withOpacity(0.2)),
              const SizedBox(width: 8),
              _TotalPill(
                  label: 'TVA ${q.taxRate.toInt()} %',
                  color: Colors.white.withOpacity(0.2)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildClientCard(QuoteClient client) {
    return _Card(
      child: Row(
        children: [
          AvatarWidget(name: client.name, color: client.color, size: 40),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(client.name,
                    style:
                        TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600)),
                Text('Client',
                    style:
                        TextStyle(fontSize: 12, color: context.appTextMuted)),
              ],
            ),
          ),
          _ActionChip(
            icon: Icons.chat_rounded,
            label: 'WhatsApp',
            color: const Color(0xFF25D366),
            onTap: _shareWhatsApp,
          ),
        ],
      ),
    );
  }

  Widget _buildItemsCard(Quote q) {
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Prestations (${q.items.length})',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
            ],
          ),
          const SizedBox(height: 10),
          ...q.items.asMap().entries.map((entry) {
            final i = entry.key;
            final item = entry.value;
            return Container(
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                border: Border(
                    top: i > 0
                        ? BorderSide(color: context.appBorder)
                        : BorderSide.none),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(item.description,
                            style: TextStyle(
                                fontSize: 13.5, fontWeight: FontWeight.w500)),
                        const SizedBox(height: 2),
                        Text(
                          '${item.quantity.toInt()} × ${_fmtXOF(item.unitPrice)}',
                          style: TextStyle(
                              fontSize: 12, color: context.appTextMuted),
                        ),
                      ],
                    ),
                  ),
                  Text(_fmtXOF(item.total),
                      style: TextStyle(
                          fontSize: 13.5, fontWeight: FontWeight.w700)),
                ],
              ),
            );
          }),
          const Divider(height: 20),
          Row(
            children: [
              const Expanded(
                child: Text('Total',
                    style:
                        TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
              ),
              Text(_fmtXOF(q.total),
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildNotesCard(String notes) {
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.notes_rounded, size: 16, color: context.appTextMuted),
              const SizedBox(width: 6),
              const Text('Notes',
                  style:
                      TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
            ],
          ),
          const SizedBox(height: 8),
          Text(notes,
              style: TextStyle(
                  fontSize: 13, color: context.appTextMuted, height: 1.5)),
        ],
      ),
    );
  }

  Widget _buildTimeline(Quote q) {
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.timeline_rounded,
                  size: 16, color: context.appTextMuted),
              const SizedBox(width: 6),
              const Text('Activité',
                  style:
                      TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
            ],
          ),
          const SizedBox(height: 12),
          _TimelineItem(
            icon: Icons.add_circle_outline_rounded,
            color: context.appTextMuted,
            label: 'Devis créé',
            date: _fmtDate(q.createdAt),
            isLast: q.status == QuoteStatus.draft,
          ),
          if (q.status != QuoteStatus.draft) ...[
            _TimelineItem(
              icon: Icons.send_rounded,
              color: const Color(0xFF2563EB),
              label: 'Envoyé au client',
              date: _fmtDate(q.issuedAt),
              isLast: q.status == QuoteStatus.sent,
            ),
          ],
          if (q.status == QuoteStatus.paid)
            _TimelineItem(
              icon: Icons.check_circle_rounded,
              color: AppColors.primary,
              label: 'Paiement reçu',
              date: '—',
              isLast: true,
            ),
          if (q.status == QuoteStatus.overdue)
            _TimelineItem(
              icon: Icons.warning_rounded,
              color: AppColors.statusOverdue,
              label: 'En retard',
              date: '—',
              isLast: true,
            ),
        ],
      ),
    );
  }

  Widget _buildActions(Quote q) {
    final plan = context.watch<AuthProvider>().user?.plan ?? 'FREE';
    final canUseMomo = plan == 'PRO' || plan == 'BUSINESS';

    return Container(
      padding: EdgeInsets.fromLTRB(
          18, 12, 18, MediaQuery.of(context).padding.bottom + 12),
      decoration: BoxDecoration(
        color: context.appSurface,
        border: Border(top: BorderSide(color: context.appBorder)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _shareWhatsApp,
                  icon: Icon(Icons.chat_rounded, size: 16),
                  label: Text('WhatsApp'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF25D366),
                    side: const BorderSide(color: Color(0xFF25D366)),
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _showSendTemplateSelector(q),
                  icon: const Icon(Icons.send_rounded, size: 16),
                  label: const Text('E-mail'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF2563EB),
                    side: const BorderSide(color: Color(0xFF2563EB)),
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 2,
                child: ElevatedButton.icon(
                  onPressed: () => _showTemplateSelector(q),
                  icon: const Icon(Icons.picture_as_pdf_rounded, size: 16),
                  label: const Text('PDF'),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => _saveAsTemplate(q),
              icon: const Icon(Icons.bookmark_add_outlined, size: 16),
              label: const Text('Enregistrer comme template'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                side: const BorderSide(color: AppColors.primary),
                padding: const EdgeInsets.symmetric(vertical: 13),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          if (canUseMomo &&
              q.status != QuoteStatus.paid &&
              !q.isAwaitingPayment) ...[
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _paymentLoading ? null : _generatePaymentLink,
                icon: _paymentLoading
                    ? const SizedBox(
                        height: 16,
                        width: 16,
                        child: CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2))
                    : Icon(Icons.account_balance_wallet_outlined, size: 16),
                label: Text(_paymentLoading
                    ? 'Génération...'
                    : 'Générer lien MoMo / Carte'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFF59E0B),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
          ],
          if (!canUseMomo &&
              q.status != QuoteStatus.paid &&
              !q.isAwaitingPayment) ...[
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: null,
                icon: const Icon(Icons.lock_rounded, size: 16),
                label: const Text('Lien MoMo / Carte · Pro'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Réservé aux plans Pro et Business.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 11.5, color: context.appTextMuted),
            ),
          ],
          if (q.isAwaitingPayment) ...[
            const SizedBox(height: 12),
            _AwaitingPaymentCard(
              onCheck: _manualCheck,
              checking: _checkingPayment,
            ),
          ],
        ],
      ),
    );
  }
}

/// Amber card rendered when the quote is SENT + has a Fedapay paymentRef.
/// Tells the freelancer we're polling automatically + exposes a manual check.
class _AwaitingPaymentCard extends StatelessWidget {
  final VoidCallback onCheck;
  final bool checking;

  const _AwaitingPaymentCard({required this.onCheck, required this.checking});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFCD34D)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const _PulsingDot(color: Color(0xFFC2691B)),
              const SizedBox(width: 8),
              const Text(
                'En attente de paiement',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF92400E),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'Votre client peut régler par Mobile Money ou carte bancaire. '
            'Dès qu’il a payé, le statut passe automatiquement à Payé.',
            style: TextStyle(
              fontSize: 11.5,
              color: Color(0xFFA1530F),
              height: 1.5,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              const Icon(Icons.refresh_rounded,
                  size: 14, color: Color(0xFF92400E)),
              const SizedBox(width: 6),
              const Text(
                'Vérification auto · toutes les 6 s',
                style: TextStyle(fontSize: 11, color: Color(0xFF92400E)),
              ),
              const Spacer(),
              OutlinedButton(
                onPressed: checking ? null : onCheck,
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Color(0xFF92400E)),
                  foregroundColor: const Color(0xFF92400E),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  minimumSize: Size.zero,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8)),
                  textStyle: const TextStyle(
                      fontSize: 11.5, fontWeight: FontWeight.w700),
                ),
                child: Text(checking ? 'Vérification…' : 'Vérifier'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PulsingDot extends StatefulWidget {
  final Color color;
  const _PulsingDot({required this.color});
  @override
  State<_PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<_PulsingDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  )..repeat();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) {
        final t = _ctrl.value;
        return SizedBox(
          width: 12,
          height: 12,
          child: Stack(alignment: Alignment.center, children: [
            Container(
              width: 12 * (1 + t * 0.6),
              height: 12 * (1 + t * 0.6),
              decoration: BoxDecoration(
                color: widget.color.withOpacity(0.5 * (1 - t)),
                shape: BoxShape.circle,
              ),
            ),
            Container(
              width: 8,
              height: 8,
              decoration:
                  BoxDecoration(color: widget.color, shape: BoxShape.circle),
            ),
          ]),
        );
      },
    );
  }
}

class _TotalPill extends StatelessWidget {
  final String label;
  final Color color;
  const _TotalPill({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(label,
          style: TextStyle(
              color: Colors.white,
              fontSize: 11.5,
              fontWeight: FontWeight.w600)),
    );
  }
}

class _ActionChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _ActionChip(
      {required this.icon,
      required this.label,
      required this.color,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 5),
            Text(label,
                style: TextStyle(
                    color: color, fontSize: 12, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}

class _TimelineItem extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label;
  final String date;
  final bool isLast;

  const _TimelineItem({
    required this.icon,
    required this.color,
    required this.label,
    required this.date,
    this.isLast = false,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, size: 14, color: color),
            ),
            if (!isLast)
              Container(width: 1, height: 20, color: context.appBorder),
          ],
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 5),
            child: Row(
              children: [
                Text(label,
                    style:
                        TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                const Spacer(),
                Text(date,
                    style:
                        TextStyle(fontSize: 11.5, color: context.appTextMuted)),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _Card extends StatelessWidget {
  final Widget child;
  const _Card({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: context.appSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.appBorder),
      ),
      child: child,
    );
  }
}
