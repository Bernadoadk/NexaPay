import 'package:flutter/material.dart';
import '../../models/quote_draft_template.dart';
import '../../services/quote_template_service.dart';
import '../../theme.dart';
import '../../utils/nav.dart';
import '../quotes/create_quote_screen.dart';

class TemplatesScreen extends StatefulWidget {
  const TemplatesScreen({super.key});

  @override
  State<TemplatesScreen> createState() => _TemplatesScreenState();
}

class _TemplatesScreenState extends State<TemplatesScreen> {
  final _searchCtrl = TextEditingController();
  bool _loading = true;
  List<QuoteDraftTemplate> _templates = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
    _searchCtrl.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final templates = await QuoteTemplateService.getAll();
      if (mounted) setState(() => _templates = templates);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Impossible de charger les templates');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
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

  List<QuoteDraftTemplate> get _filtered {
    final q = _searchCtrl.text.trim().toLowerCase();
    if (q.isEmpty) return _templates;
    return _templates
        .where((t) =>
            t.name.toLowerCase().contains(q) ||
            t.title.toLowerCase().contains(q) ||
            (t.category ?? '').toLowerCase().contains(q) ||
            (t.description ?? '').toLowerCase().contains(q))
        .toList();
  }

  Future<void> _delete(QuoteDraftTemplate template) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Supprimer ce template ?'),
        content: Text(
          '"${template.name}" ne sera plus disponible pour créer de nouveaux devis.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Annuler'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.statusOverdue,
              foregroundColor: Colors.white,
            ),
            child: const Text('Supprimer'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await QuoteTemplateService.delete(template.id);
      if (mounted) {
        setState(() => _templates.removeWhere((t) => t.id == template.id));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Suppression impossible')),
        );
      }
    }
  }

  void _useTemplate(QuoteDraftTemplate template) {
    Navigator.push(
      context,
      fadeSlideRoute(CreateQuoteScreen(initialTemplate: template)),
    ).then((_) => _load());
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    return Scaffold(
      backgroundColor: context.appBg,
      body: Column(
        children: [
          _buildTopBar(),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 12, 18, 8),
            child: TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.search_rounded),
                hintText: 'Rechercher un template...',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(color: AppColors.primary),
                  )
                : _error != null
                    ? Center(
                        child: Text(_error!,
                            style: TextStyle(color: context.appTextMuted)),
                      )
                    : _templates.isEmpty
                        ? _EmptyTemplates(onCreate: () {
                            Navigator.push(
                              context,
                              fadeSlideRoute(const CreateQuoteScreen()),
                            ).then((_) => _load());
                          })
                        : filtered.isEmpty
                            ? Center(
                                child: Text('Aucun résultat',
                                    style:
                                        TextStyle(color: context.appTextMuted)),
                              )
                            : RefreshIndicator(
                                color: AppColors.primary,
                                onRefresh: _load,
                                child: ListView.separated(
                                  padding:
                                      const EdgeInsets.fromLTRB(18, 6, 18, 24),
                                  itemCount: filtered.length,
                                  separatorBuilder: (_, __) =>
                                      const SizedBox(height: 10),
                                  itemBuilder: (_, i) {
                                    final template = filtered[i];
                                    return _TemplateCard(
                                      template: template,
                                      amount: _fmtXOF(template.total),
                                      onUse: () => _useTemplate(template),
                                      onDelete: () => _delete(template),
                                    );
                                  },
                                ),
                              ),
          ),
        ],
      ),
    );
  }

  Widget _buildTopBar() {
    return Container(
      padding: EdgeInsets.fromLTRB(
        14,
        MediaQuery.of(context).padding.top + 10,
        14,
        10,
      ),
      decoration: BoxDecoration(
        color: context.appSurface,
        border: Border(bottom: BorderSide(color: context.appBorder)),
      ),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
            onPressed: () => Navigator.pop(context),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Templates',
                    style:
                        TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                Text(
                  '${_templates.length} base${_templates.length > 1 ? 's' : ''} de devis',
                  style: TextStyle(fontSize: 11.5, color: context.appTextMuted),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.add_rounded, size: 22),
            onPressed: () => Navigator.push(
              context,
              fadeSlideRoute(const CreateQuoteScreen()),
            ).then((_) => _load()),
          ),
        ],
      ),
    );
  }
}

class _TemplateCard extends StatelessWidget {
  final QuoteDraftTemplate template;
  final String amount;
  final VoidCallback onUse;
  final VoidCallback onDelete;

  const _TemplateCard({
    required this.template,
    required this.amount,
    required this.onUse,
    required this.onDelete,
  });

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
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.receipt_long_rounded,
                    color: AppColors.primary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(template.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w700)),
                    Text(template.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            fontSize: 12, color: context.appTextMuted)),
                  ],
                ),
              ),
              Text(amount,
                  style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary)),
            ],
          ),
          if (template.description != null &&
              template.description!.trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              template.description!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  fontSize: 12, color: context.appTextMuted, height: 1.35),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              _MetaPill(
                  label: template.category ?? 'Sans catégorie',
                  icon: Icons.folder_outlined),
              const SizedBox(width: 8),
              _MetaPill(
                  label:
                      '${template.items.length} ligne${template.items.length > 1 ? 's' : ''}',
                  icon: Icons.list_rounded),
              const SizedBox(width: 8),
              _MetaPill(
                  label:
                      '${template.usageCount} usage${template.usageCount > 1 ? 's' : ''}',
                  icon: Icons.repeat_rounded),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: onUse,
                  icon: const Icon(Icons.copy_rounded, size: 16),
                  label: const Text('Utiliser'),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                onPressed: onDelete,
                icon: const Icon(Icons.delete_outline_rounded),
                color: AppColors.statusOverdue,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MetaPill extends StatelessWidget {
  final String label;
  final IconData icon;

  const _MetaPill({required this.label, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Flexible(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
        decoration: BoxDecoration(
          color: context.appBg,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: context.appBorder),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 12, color: context.appTextMuted),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 10.5, color: context.appTextMuted),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyTemplates extends StatelessWidget {
  final VoidCallback onCreate;

  const _EmptyTemplates({required this.onCreate});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 58,
              height: 58,
              decoration: BoxDecoration(
                color: AppColors.primarySoft,
                borderRadius: BorderRadius.circular(18),
              ),
              child: const Icon(Icons.receipt_long_rounded,
                  color: AppColors.primary, size: 28),
            ),
            const SizedBox(height: 14),
            const Text('Aucun template',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text(
              'Créez un devis type puis sauvegardez-le comme template.',
              textAlign: TextAlign.center,
              style: TextStyle(color: context.appTextMuted, height: 1.4),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: onCreate,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Créer un devis'),
            ),
          ],
        ),
      ),
    );
  }
}
