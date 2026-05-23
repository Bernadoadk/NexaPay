import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:dio/dio.dart';
import '../../theme.dart';
import '../../models/quote.dart';
import '../../models/client.dart';
import '../../models/product.dart';
import '../../providers/quotes_provider.dart';
import '../../providers/clients_provider.dart';
import '../../providers/products_provider.dart';
import '../../providers/credits_provider.dart';
import '../../services/ai_service.dart';
import '../../widgets/avatar_widget.dart';

class _LineItem {
  final TextEditingController desc;
  final TextEditingController qty;
  final TextEditingController price;
  final TextEditingController unit;
  /// Set when the line was created from a catalog product — propagates to
  /// QuoteItem.productId so the usage stats stay accurate.
  String? productId;

  _LineItem()
      : desc = TextEditingController(),
        qty = TextEditingController(text: '1'),
        price = TextEditingController(),
        unit = TextEditingController();

  factory _LineItem.fromProduct(Product p) {
    final desc = p.description != null && p.description!.trim().isNotEmpty
        ? '${p.name} — ${p.description!.trim()}'
        : p.name;
    return _LineItem()
      ..desc.text = desc
      ..qty.text = '1'
      ..price.text = p.price.toStringAsFixed(0)
      ..unit.text = p.unit ?? ''
      ..productId = p.id;
  }

  double get total {
    final q = double.tryParse(qty.text) ?? 1;
    final p = double.tryParse(price.text.replaceAll(' ', '')) ?? 0;
    return q * p;
  }

  QuoteItem toModel(int order) => QuoteItem(
        description: desc.text,
        quantity: double.tryParse(qty.text) ?? 1,
        unitPrice: double.tryParse(price.text.replaceAll(' ', '')) ?? 0,
        total: total,
        unit: unit.text.trim().isEmpty ? null : unit.text.trim(),
        productId: productId,
        order: order,
      );

  void dispose() {
    desc.dispose();
    qty.dispose();
    price.dispose();
    unit.dispose();
  }
}

class CreateQuoteScreen extends StatefulWidget {
  const CreateQuoteScreen({super.key});

  @override
  State<CreateQuoteScreen> createState() => _CreateQuoteScreenState();
}

class _CreateQuoteScreenState extends State<CreateQuoteScreen> {
  final _titleCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  Client? _selectedClient;
  final List<_LineItem> _lines = [_LineItem()];
  bool _loading = false;
  String? _error;

  // — IA panel state ----------------------------------------------------------
  // `_aiOpen` toggles the inline panel under the lines card. The textarea lives
  // in `_aiDescCtrl`. Credit balance comes from `CreditsProvider`, refreshed
  // after every generation (success OR failure — the backend refunds on error
  // but we re-sync to be safe).
  final _aiDescCtrl = TextEditingController();
  bool _aiOpen = false;
  bool _aiLoading = false;
  String? _aiError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<ClientsProvider>().loadClients();
      // Preload the product catalog so the picker opens instantly.
      context.read<ProductsProvider>().load();
      // Make sure the AI button shows an up-to-date credit count.
      context.read<CreditsProvider>().refresh(silent: true);
    });
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _notesCtrl.dispose();
    _aiDescCtrl.dispose();
    for (final l in _lines) {
      l.dispose();
    }
    super.dispose();
  }

  double get _subtotal => _lines.fold(0.0, (s, l) => s + l.total);
  double get _tva => _subtotal * 0.18;
  double get _total => _subtotal + _tva;

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

  Future<void> _submit() async {
    if (_titleCtrl.text.trim().isEmpty) {
      setState(() => _error = 'Titre du devis requis');
      return;
    }
    if (_selectedClient == null) {
      setState(() => _error = 'Veuillez sélectionner un client');
      return;
    }
    if (_lines.every((l) => l.desc.text.trim().isEmpty)) {
      setState(() => _error = 'Ajoutez au moins une ligne');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await context.read<QuotesProvider>().createQuote(
            title: _titleCtrl.text.trim(),
            clientId: _selectedClient!.id,
            items: _lines
                .asMap()
                .entries
                .map((e) => e.value.toModel(e.key))
                .toList(),
            notes: _notesCtrl.text.trim().isNotEmpty
                ? _notesCtrl.text.trim()
                : null,
          );
      if (mounted) Navigator.pop(context);
    } on DioException catch (e) {
      setState(() =>
          _error = e.response?.data?['message'] ?? 'Erreur lors de la création');
    } catch (_) {
      setState(() => _error = 'Erreur inattendue');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// AI-driven quote generation. Calls `/ai/generate-quote` with the user's
  /// freeform description and rewrites `_titleCtrl` + `_lines` with the result.
  /// One credit is debited server-side; refunded automatically on failure.
  Future<void> _runAiGeneration() async {
    final desc = _aiDescCtrl.text.trim();
    if (desc.isEmpty) return;
    setState(() {
      _aiLoading = true;
      _aiError = null;
    });
    try {
      final res = await AiService.generateQuote(desc);
      if (!mounted) return;
      setState(() {
        if (res.title != null && res.title!.trim().isNotEmpty) {
          _titleCtrl.text = res.title!.trim();
        }
        if (res.items.isNotEmpty) {
          // Replace existing lines entirely — mirrors the web behaviour. The
          // user can still tweak them line-by-line after the panel closes.
          for (final l in _lines) {
            l.dispose();
          }
          _lines
            ..clear()
            ..addAll(res.items.map((it) {
              return _LineItem()
                ..desc.text = it.description
                ..qty.text = it.quantity == it.quantity.truncate()
                    ? it.quantity.toInt().toString()
                    : it.quantity.toString()
                ..price.text = it.unitPrice.toStringAsFixed(0);
            }));
        }
        _aiOpen = false;
        _aiDescCtrl.clear();
      });
    } on DioException catch (e) {
      final body = e.response?.data;
      final msg = (body is Map ? body['message'] : null) as String?;
      setState(() => _aiError = msg ?? 'Erreur IA — réessayez');
      // Server may include the up-to-date credit count in the error body —
      // surface it immediately so the chip stays accurate even on failure.
      if (body is Map && body['aiCredits'] is num) {
        context.read<CreditsProvider>().localUseCredit(0); // touch
      }
    } catch (_) {
      setState(() => _aiError = 'Erreur IA — réessayez');
    } finally {
      if (mounted) {
        setState(() => _aiLoading = false);
        // Always re-sync the balance — covers both success-debit and
        // failure-refund paths from the backend.
        context.read<CreditsProvider>().refresh(silent: true);
      }
    }
  }

  /// Bottom sheet — searchable product picker grouped by category.
  /// Picking an item appends a new `_LineItem` to the quote with the product's
  /// price/unit/description and links the line via `productId` for stats.
  Future<void> _openProductPicker(BuildContext ctx) async {
    final picked = await showModalBottomSheet<Product>(
      context: ctx,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (_) => const _ProductPickerSheet(),
    );
    if (picked != null && mounted) {
      setState(() {
        // Replace the first empty line if any, otherwise append.
        final emptyIdx = _lines.indexWhere(
            (l) => l.desc.text.trim().isEmpty && l.price.text.trim().isEmpty);
        final newLine = _LineItem.fromProduct(picked);
        if (emptyIdx >= 0) {
          _lines[emptyIdx].dispose();
          _lines[emptyIdx] = newLine;
        } else {
          _lines.add(newLine);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.appBg,
      body: Column(
        children: [
          _buildTopBar(),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_error != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.statusOverdue.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                            color: AppColors.statusOverdue.withOpacity(0.3)),
                      ),
                      child: Text(_error!,
                          style: TextStyle(
                              color: AppColors.statusOverdue, fontSize: 13.5)),
                    ),
                    const SizedBox(height: 14),
                  ],
                  _buildCard(
                    child: TextField(
                      controller: _titleCtrl,
                      decoration: InputDecoration(
                        hintText: 'Titre du devis',
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        contentPadding: EdgeInsets.zero,
                        filled: false,
                      ),
                      style: TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w500),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _buildClientPicker(),
                  const SizedBox(height: 12),
                  _buildLinesCard(),
                  const SizedBox(height: 12),
                  _buildTotalsCard(),
                  const SizedBox(height: 12),
                  _buildCard(
                    child: TextField(
                      controller: _notesCtrl,
                      maxLines: 3,
                      decoration: InputDecoration(
                        hintText: 'Notes (optionnel)',
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        contentPadding: EdgeInsets.zero,
                        filled: false,
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
          _buildActions(),
        ],
      ),
    );
  }

  Widget _buildTopBar() {
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
            icon: Icon(Icons.close_rounded),
            onPressed: () => Navigator.pop(context),
          ),
          const Expanded(
            child: Text('Nouveau devis',
                style:
                    TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  Widget _buildCard({required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: context.appSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.appBorder),
      ),
      child: child,
    );
  }

  Widget _buildClientPicker() {
    return Consumer<ClientsProvider>(
      builder: (ctx, prov, _) => _buildCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Client',
                style: TextStyle(
                    fontSize: 11,
                    color: context.appTextMuted,
                    letterSpacing: 0.3)),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: () => _showClientPicker(prov.clients),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: context.appBorder),
                ),
                child: Row(
                  children: [
                    if (_selectedClient != null) ...[
                      AvatarWidget(
                          name: _selectedClient!.name,
                          color: _selectedClient!.color,
                          size: 32),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(_selectedClient!.name,
                                style: TextStyle(
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.w500)),
                            if (_selectedClient!.city != null)
                              Text(_selectedClient!.city!,
                                  style: TextStyle(
                                      fontSize: 11.5,
                                      color: context.appTextMuted)),
                          ],
                        ),
                      ),
                    ] else ...[
                      Icon(Icons.person_outline,
                          color: context.appTextMuted),
                      const SizedBox(width: 8),
                      Expanded(
                          child: Text('Sélectionner un client',
                              style: TextStyle(
                                  color: context.appTextMuted, fontSize: 14))),
                    ],
                    Icon(Icons.keyboard_arrow_down_rounded,
                        color: context.appTextMuted),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showClientPicker(List<Client> clients) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        maxChildSize: 0.9,
        minChildSize: 0.4,
        expand: false,
        builder: (_, ctrl) => Column(
          children: [
            const SizedBox(height: 8),
            Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                    color: context.appBorder,
                    borderRadius: BorderRadius.circular(2))),
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('Choisir un client',
                  style: TextStyle(
                      fontSize: 15, fontWeight: FontWeight.w600)),
            ),
            Expanded(
              child: clients.isEmpty
                  ? Center(
                      child: Text('Aucun client',
                          style: TextStyle(color: context.appTextMuted)))
                  : ListView.builder(
                      controller: ctrl,
                      itemCount: clients.length,
                      itemBuilder: (_, i) {
                        final c = clients[i];
                        return ListTile(
                          leading: AvatarWidget(
                              name: c.name, color: c.color, size: 36),
                          title: Text(c.name,
                              style: TextStyle(fontSize: 13.5)),
                          subtitle: c.city != null ? Text(c.city!) : null,
                          onTap: () {
                            setState(() => _selectedClient = c);
                            Navigator.pop(context);
                          },
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLinesCard() {
    return _buildCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                  child: Text('Lignes',
                      style: TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w600))),
              Text(
                  '${_lines.length} article${_lines.length > 1 ? 's' : ''}',
                  style: TextStyle(
                      fontSize: 11, color: context.appTextMuted)),
            ],
          ),
          ..._lines.asMap().entries.map((entry) {
            final i = entry.key;
            final line = entry.value;
            return Container(
              padding: const EdgeInsets.only(top: 10),
              decoration: BoxDecoration(
                border: Border(
                    top: i > 0
                        ? BorderSide(color: context.appBorder)
                        : BorderSide.none),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: line.desc,
                          decoration: InputDecoration(
                            hintText: 'Description de la prestation',
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            contentPadding: EdgeInsets.zero,
                            filled: false,
                          ),
                          style: TextStyle(fontSize: 13.5),
                          onChanged: (_) => setState(() {}),
                        ),
                      ),
                      if (_lines.length > 1)
                        GestureDetector(
                          onTap: () => setState(() => _lines.removeAt(i)),
                          child: Icon(Icons.close_rounded,
                              size: 16, color: context.appTextMuted),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      SizedBox(
                        width: 44,
                        child: TextField(
                          controller: line.qty,
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            hintText: 'Qté',
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            contentPadding: EdgeInsets.zero,
                            filled: false,
                          ),
                          style: TextStyle(
                              fontSize: 12, color: context.appTextMuted),
                          onChanged: (_) => setState(() {}),
                        ),
                      ),
                      SizedBox(
                        width: 60,
                        child: TextField(
                          controller: line.unit,
                          decoration: InputDecoration(
                            hintText: 'unité',
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            contentPadding: EdgeInsets.zero,
                            filled: false,
                          ),
                          style: TextStyle(
                              fontSize: 11.5, color: context.appTextMuted),
                        ),
                      ),
                      Text(' × ',
                          style: TextStyle(color: context.appTextMuted)),
                      Expanded(
                        child: TextField(
                          controller: line.price,
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            hintText: 'Prix (F)',
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            contentPadding: EdgeInsets.zero,
                            filled: false,
                          ),
                          style: TextStyle(
                              fontSize: 12, color: context.appTextMuted),
                          onChanged: (_) => setState(() {}),
                        ),
                      ),
                      Text(_fmtXOF(line.total),
                          style: TextStyle(
                              fontSize: 13, fontWeight: FontWeight.w500)),
                    ],
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _lines.add(_LineItem())),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: context.appBorder),
                      color: context.appBg,
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.add_rounded,
                            size: 16, color: AppColors.primary),
                        SizedBox(width: 6),
                        Text('Ligne vide',
                            style: TextStyle(
                                color: AppColors.primary,
                                fontSize: 13,
                                fontWeight: FontWeight.w500)),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: GestureDetector(
                  onTap: () => _openProductPicker(context),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      color: AppColors.primarySoft,
                      border: Border.all(color: AppColors.primary),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.inventory_2_outlined,
                            size: 16, color: AppColors.primary),
                        SizedBox(width: 6),
                        Text('Catalogue',
                            style: TextStyle(
                                color: AppColors.primary,
                                fontSize: 13,
                                fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          _buildAiTrigger(),
          if (_aiOpen) ...[
            const SizedBox(height: 10),
            _buildAiPanel(),
          ],
        ],
      ),
    );
  }

  /// Compact full-width button that toggles the AI panel. Shows the current
  /// credit balance inline so the user knows the cost before opening it.
  Widget _buildAiTrigger() {
    final credits = context.watch<CreditsProvider>().aiCredits;
    return GestureDetector(
      onTap: () => setState(() {
        _aiOpen = !_aiOpen;
        _aiError = null;
      }),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 12),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF0F8F65), Color(0xFF0C7A56)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.auto_awesome_rounded,
                color: Colors.white, size: 16),
            const SizedBox(width: 8),
            const Text(
              'Générer avec IA',
              style: TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.18),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                '$credits crédit${credits == 1 ? '' : 's'}',
                style: const TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
            const SizedBox(width: 4),
            Icon(
              _aiOpen
                  ? Icons.keyboard_arrow_up_rounded
                  : Icons.keyboard_arrow_down_rounded,
              size: 18,
              color: Colors.white,
            ),
          ],
        ),
      ),
    );
  }

  /// Inline panel: textarea + Generate / Cancel + low-credit upsell.
  Widget _buildAiPanel() {
    final credits = context.watch<CreditsProvider>().aiCredits;
    final canGenerate = !_aiLoading &&
        credits >= 1 &&
        _aiDescCtrl.text.trim().isNotEmpty;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.primary.withOpacity(0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Décrivez votre prestation — l\'IA génère le devis (1 crédit).',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _aiDescCtrl,
            maxLines: 3,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              hintText:
                  'Ex : Pose de carrelage 20 m², matériaux inclus, '
                  'appartement Cotonou…',
              hintStyle: TextStyle(
                  fontSize: 12.5, color: context.appTextMuted),
              filled: true,
              fillColor: context.appSurface,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(
                    color: AppColors.primary.withOpacity(0.3)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(
                    color: AppColors.primary.withOpacity(0.3)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide:
                    const BorderSide(color: AppColors.primary, width: 1.5),
              ),
              isDense: true,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
            ),
            style: const TextStyle(fontSize: 13),
          ),
          if (_aiError != null) ...[
            const SizedBox(height: 6),
            Text(
              _aiError!,
              style: TextStyle(
                  fontSize: 12, color: AppColors.statusOverdue),
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              ElevatedButton.icon(
                onPressed: canGenerate ? _runAiGeneration : null,
                icon: _aiLoading
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2),
                      )
                    : const Icon(Icons.auto_awesome_rounded, size: 14),
                label: Text(_aiLoading ? 'Génération…' : 'Générer'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 9),
                  minimumSize: Size.zero,
                  textStyle: const TextStyle(
                      fontSize: 12.5, fontWeight: FontWeight.w700),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8)),
                ),
              ),
              const SizedBox(width: 8),
              TextButton(
                onPressed: _aiLoading
                    ? null
                    : () => setState(() => _aiOpen = false),
                style: TextButton.styleFrom(
                  foregroundColor: context.appTextMuted,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 8),
                  minimumSize: Size.zero,
                  textStyle: const TextStyle(fontSize: 12.5),
                ),
                child: const Text('Annuler'),
              ),
            ],
          ),
          if (credits < 1) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFFCD34D)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded,
                      size: 14, color: Color(0xFF92400E)),
                  const SizedBox(width: 6),
                  const Expanded(
                    child: Text(
                      'Crédits insuffisants pour générer.',
                      style: TextStyle(
                        fontSize: 11.5,
                        color: Color(0xFF92400E),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: () =>
                        Navigator.of(context).pushNamed('/credits'),
                    child: const Text(
                      'Acheter',
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF92400E),
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildTotalsCard() {
    return _buildCard(
      child: Column(
        children: [
          _TotalRow(label: 'Sous-total', value: _fmtXOF(_subtotal)),
          const SizedBox(height: 8),
          _TotalRow(label: 'TVA 18 %', value: _fmtXOF(_tva)),
          Divider(color: context.appBorder, height: 20),
          Row(
            children: [
              const Expanded(
                  child: Text('Total TTC',
                      style: TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w600))),
              Text(_fmtXOF(_total),
                  style: TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w700)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActions() {
    return Container(
      padding: EdgeInsets.fromLTRB(
          18, 12, 18, MediaQuery.of(context).padding.bottom + 12),
      decoration: BoxDecoration(
        color: context.appSurface,
        border: Border(top: BorderSide(color: context.appBorder)),
      ),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton(
              onPressed: _loading ? null : _submit,
              style: OutlinedButton.styleFrom(
                foregroundColor: context.appText,
                side: BorderSide(color: context.appBorder),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: Text('Brouillon'),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            flex: 2,
            child: ElevatedButton.icon(
              onPressed: _loading ? null : _submit,
              icon: _loading
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2))
                  : Icon(Icons.send_rounded, size: 16),
              label: Text('Envoyer · PDF'),
            ),
          ),
        ],
      ),
    );
  }
}

class _TotalRow extends StatelessWidget {
  final String label;
  final String value;

  const _TotalRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
            child: Text(label,
                style: TextStyle(
                    fontSize: 13, color: context.appTextMuted))),
        Text(value, style: TextStyle(fontSize: 13)),
      ],
    );
  }
}

// ── Product picker (catalog → quote line) ─────────────────────────────────────

class _ProductPickerSheet extends StatefulWidget {
  const _ProductPickerSheet();

  @override
  State<_ProductPickerSheet> createState() => _ProductPickerSheetState();
}

class _ProductPickerSheetState extends State<_ProductPickerSheet> {
  String _search = '';

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

  @override
  Widget build(BuildContext context) {
    final products = context.watch<ProductsProvider>().products;
    // Active products only — archived items should never reach the picker.
    final active = products.where((p) => !p.archived).toList();
    final q = _search.trim().toLowerCase();
    final filtered = q.isEmpty
        ? active
        : active.where((p) {
            return p.name.toLowerCase().contains(q) ||
                (p.description ?? '').toLowerCase().contains(q) ||
                (p.category ?? '').toLowerCase().contains(q);
          }).toList();

    // Group by category, "Sans catégorie" last.
    final grouped = <String, List<Product>>{};
    for (final p in filtered) {
      final key = (p.category ?? '').trim();
      grouped.putIfAbsent(key, () => []).add(p);
    }
    final categories = grouped.keys.toList()
      ..sort((a, b) {
        if (a.isEmpty) return 1;
        if (b.isEmpty) return -1;
        return a.compareTo(b);
      });

    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (_, scrollCtrl) {
        return Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom,
          ),
          child: Column(
            children: [
              // Grabber
              Center(
                child: Container(
                  margin: const EdgeInsets.only(top: 8, bottom: 4),
                  width: 36, height: 4,
                  decoration: BoxDecoration(
                    color: context.appBorder,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              // Header + search
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Catalogue produits & services',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: context.appText,
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      autofocus: false,
                      decoration: InputDecoration(
                        prefixIcon: Icon(Icons.search_rounded,
                            size: 18, color: context.appTextMuted),
                        hintText:
                            'Rechercher (nom, description, catégorie)…',
                        hintStyle: TextStyle(
                            fontSize: 13, color: context.appTextSubtle),
                        isDense: true,
                        contentPadding:
                            const EdgeInsets.symmetric(vertical: 10),
                      ),
                      onChanged: (v) => setState(() => _search = v),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: filtered.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.inventory_2_outlined,
                                  size: 36, color: context.appTextMuted),
                              const SizedBox(height: 10),
                              Text(
                                q.isEmpty
                                    ? 'Aucun produit dans le catalogue'
                                    : 'Aucun résultat pour « $q »',
                                style: TextStyle(
                                    fontSize: 13,
                                    color: context.appTextMuted),
                              ),
                            ],
                          ),
                        ),
                      )
                    : ListView.builder(
                        controller: scrollCtrl,
                        padding: const EdgeInsets.only(bottom: 24),
                        itemCount: _buildSlotCount(categories, grouped),
                        itemBuilder: (_, i) =>
                            _buildSlot(i, categories, grouped),
                      ),
              ),
              Container(
                padding: const EdgeInsets.fromLTRB(18, 10, 18, 14),
                decoration: BoxDecoration(
                  color: context.appSurface,
                  border:
                      Border(top: BorderSide(color: context.appBorder)),
                ),
                child: Row(
                  children: [
                    Text(
                      '${filtered.length} / ${active.length}',
                      style: TextStyle(
                          fontSize: 11.5, color: context.appTextMuted),
                    ),
                    const Spacer(),
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Fermer'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  /// Each rendered item is either a section header or a product row — count
  /// both up-front so ListView.builder can index into a flat list.
  int _buildSlotCount(
      List<String> categories, Map<String, List<Product>> grouped) {
    int count = 0;
    for (final cat in categories) {
      count++; // header
      count += grouped[cat]!.length;
    }
    return count;
  }

  Widget _buildSlot(int index, List<String> categories,
      Map<String, List<Product>> grouped) {
    int cursor = 0;
    for (final cat in categories) {
      if (index == cursor) {
        return _CategoryHeader(
          label: cat.isEmpty ? 'Sans catégorie' : cat,
          count: grouped[cat]!.length,
        );
      }
      cursor++;
      final items = grouped[cat]!;
      if (index < cursor + items.length) {
        final p = items[index - cursor];
        return _ProductRow(
          product: p,
          fmtXOF: _fmtXOF,
          onTap: () => Navigator.pop(context, p),
        );
      }
      cursor += items.length;
    }
    return const SizedBox.shrink();
  }
}

class _CategoryHeader extends StatelessWidget {
  final String label;
  final int count;
  const _CategoryHeader({required this.label, required this.count});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 6),
      color: context.appBg,
      child: Text(
        '${label.toUpperCase()} · $count',
        style: TextStyle(
          fontSize: 10.5,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.7,
          color: context.appTextMuted,
        ),
      ),
    );
  }
}

class _ProductRow extends StatelessWidget {
  final Product product;
  final String Function(double) fmtXOF;
  final VoidCallback onTap;
  const _ProductRow({
    required this.product,
    required this.fmtXOF,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 10, 18, 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 32, height: 32,
              decoration: BoxDecoration(
                color: AppColors.primarySoft,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.inventory_2_outlined,
                  size: 16, color: AppColors.primary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          product.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w600,
                            color: context.appText,
                          ),
                        ),
                      ),
                      Text(
                        fmtXOF(product.price) +
                            (product.unit != null ? '/${product.unit}' : ''),
                        style: const TextStyle(
                          fontSize: 12,
                          fontFamily: 'monospace',
                          color: AppColors.primary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  if (product.description != null &&
                      product.description!.trim().isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      product.description!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 11.5,
                        color: context.appTextMuted,
                      ),
                    ),
                  ],
                  if (product.usageCount > 0) ...[
                    const SizedBox(height: 2),
                    Text(
                      '${product.usageCount}× déjà utilisé',
                      style: TextStyle(
                        fontSize: 10.5,
                        color: context.appTextSubtle,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
