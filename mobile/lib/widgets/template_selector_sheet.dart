import 'dart:typed_data';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:printing/printing.dart';
import 'package:provider/provider.dart';
import '../theme.dart';
import '../models/quote.dart';
import '../providers/auth_provider.dart';
import '../services/quote_pdf_service.dart';
import '../services/quote_service.dart';

enum TemplateSelectorMode { exportPdf, sendEmail }

// ─── Catégories ───────────────────────────────────────────────────────────────

const _categories = [
  ('tous',      'Tous'),
  ('classique', 'Classique'),
  ('dynamique', 'Dynamique'),
  ('épuré',     'Épuré'),
  ('moderne',   'Moderne'),
];

// ─── Widget principal ─────────────────────────────────────────────────────────

class TemplateSelectorSheet extends StatefulWidget {
  final Quote quote;
  final TemplateSelectorMode mode;
  final ValueChanged<Quote>? onSent;

  const TemplateSelectorSheet({
    super.key,
    required this.quote,
    this.mode = TemplateSelectorMode.exportPdf,
    this.onSent,
  });

  @override
  State<TemplateSelectorSheet> createState() => _TemplateSelectorSheetState();
}

class _TemplateSelectorSheetState extends State<TemplateSelectorSheet> {
  String _selectedId = 'classique';
  String _activeCategory = 'tous';
  bool _generating = false;
  String? _sendError;

  // Cache des PDF générés pour ne pas re-générer à chaque tap
  final Map<String, Uint8List> _previewCache = {};

  bool get _isBusiness => _currentPlan == 'BUSINESS';

  List<QuoteTemplate> get _availableTemplates => _isBusiness
      ? kQuoteTemplates
      : kQuoteTemplates.where((t) => t.category == 'classique').toList();

  List<(String, String)> get _availableCategories => _isBusiness
      ? _categories
      : _categories.where((c) => c.$1 == 'tous' || c.$1 == 'classique').toList();

  List<QuoteTemplate> get _filtered {
    if (_activeCategory == 'tous') return _availableTemplates;
    return _availableTemplates.where((t) => t.category == _activeCategory).toList();
  }

  QuoteTemplate get _selectedTemplate =>
      _availableTemplates.firstWhere((t) => t.id == _selectedId, orElse: () => _availableTemplates.first);

  String get _currentPlan =>
      context.read<AuthProvider>().user?.plan ?? 'FREE';

  // Génère ou récupère depuis le cache
  Future<Uint8List> _getPreview(String id) async {
    if (_previewCache.containsKey(id)) return _previewCache[id]!;
    final bytes =
        await QuotePdfService.generate(widget.quote, id, plan: _currentPlan);
    if (mounted) _previewCache[id] = bytes;
    return bytes;
  }

  void _selectTemplate(String id) {
    if (id == _selectedId) return;
    setState(() => _selectedId = id);
  }

  void _selectCategory(String cat) {
    setState(() {
      _activeCategory = cat;
      // Si le template sélectionné n'est pas dans la catégorie, prendre le premier
      final filtered = cat == 'tous'
          ? _availableTemplates
          : _availableTemplates.where((t) => t.category == cat).toList();
      if (filtered.isNotEmpty && !filtered.any((t) => t.id == _selectedId)) {
        _selectedId = filtered.first.id;
      }
    });
  }

  Future<void> _export() async {
    setState(() => _generating = true);
    try {
      final bytes = _previewCache[_selectedId] ??
          await QuotePdfService.generate(widget.quote, _selectedId,
              plan: _currentPlan);
      await Printing.sharePdf(bytes: bytes, filename: '${widget.quote.number}.pdf');
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Erreur lors de la génération du PDF')),
        );
      }
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  Future<void> _sendEmail() async {
    setState(() {
      _generating = true;
      _sendError = null;
    });
    try {
      final bytes = _previewCache[_selectedId] ??
          await QuotePdfService.generate(widget.quote, _selectedId,
              plan: _currentPlan);
      final updated = await QuoteService.sendEmail(
        id: widget.quote.id,
        pdfBase64: base64Encode(bytes),
        templateId: _selectedId,
        templateName: _selectedTemplate.name,
      );
      widget.onSent?.call(updated);
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Devis envoyé par e-mail')),
        );
      }
    } catch (_) {
      if (mounted) {
        setState(() => _sendError = 'Impossible d’envoyer le devis par e-mail');
      }
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  Future<void> _confirm() {
    if (widget.mode == TemplateSelectorMode.sendEmail) return _sendEmail();
    return _export();
  }

  void _openPreview() {
    Navigator.of(context).push(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => _TemplatePreviewPage(
          template: _selectedTemplate,
          buildPreview: () => _getPreview(_selectedId),
          onExport: _confirm,
          generating: _generating,
          mode: widget.mode,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final screenH = MediaQuery.of(context).size.height;
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return Container(
      height: screenH * 0.93,
      decoration: BoxDecoration(
        color: context.appSurface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          // ── Handle ──
          Padding(
            padding: const EdgeInsets.only(top: 10, bottom: 2),
            child: Container(
              width: 36, height: 4,
              decoration: BoxDecoration(
                color: context.appBorder,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // ── Header ──
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 10, 12, 6),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Choisir un modèle',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: context.appText,
                        ),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        widget.mode == TemplateSelectorMode.sendEmail
                            ? 'Ce modèle sera envoyé au client'
                            : 'Sélectionnez un modèle qui vous correspond',
                        style: TextStyle(fontSize: 11, color: context.appTextMuted),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: Icon(Icons.close_rounded, size: 20, color: context.appTextMuted),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),

          // ── Chips catégories ──
          SizedBox(
            height: 36,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _availableCategories.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final (id, label) = _availableCategories[i];
                final active = id == _activeCategory;
                return GestureDetector(
                  onTap: () => _selectCategory(id),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                    decoration: BoxDecoration(
                      color: active ? AppColors.primary : context.appSurface2,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: active ? AppColors.primary : context.appBorder,
                        width: 1,
                      ),
                    ),
                    child: Text(
                      label,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: active ? Colors.white : context.appTextMuted,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),

          const SizedBox(height: 12),
          Divider(height: 1, color: context.appBorder),

          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: context.appSurface2,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: context.appBorder),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Modèle sélectionné',
                          style: TextStyle(
                            fontSize: 11,
                            color: context.appTextMuted,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                _selectedTemplate.name,
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w800,
                                  color: context.appText,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.primary.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                _selectedTemplate.category,
                                style: TextStyle(
                                  fontSize: 10,
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  OutlinedButton.icon(
                    onPressed: _openPreview,
                    icon: const Icon(Icons.visibility_outlined, size: 18),
                    label: const Text('Aperçu'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.primary,
                      side: const BorderSide(color: AppColors.primary),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                    ),
                  ),
                ],
              ),
            ),
          ),

          Divider(height: 1, color: context.appBorder),

          // ── Grille des templates ──
          Expanded(
            child: Column(
              children: [
                // Compteur + nom du template sélectionné
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
                  child: Row(
                    children: [
                      Text(
                        'Templates',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: context.appText),
                      ),
                      const Spacer(),
                      Text(
                        '${_filtered.length} modèle${_filtered.length > 1 ? 's' : ''}',
                        style: TextStyle(fontSize: 11, color: context.appTextMuted),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: GridView.builder(
                    padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                      childAspectRatio: MediaQuery.of(context).size.width < 380 ? 0.58 : 0.62,
                    ),
                    itemCount: _filtered.length,
                    itemBuilder: (_, i) {
                      final tmpl = _filtered[i];
                      final selected = tmpl.id == _selectedId;
                      return GestureDetector(
                        onTap: () => _selectTemplate(tmpl.id),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 150),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: selected ? AppColors.primary : context.appBorder,
                              width: selected ? 2 : 1,
                            ),
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(9),
                            child: Column(
                              children: [
                                Expanded(child: _TemplateThumbnail(tmpl: tmpl)),
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.symmetric(vertical: 5),
                                  color: selected
                                      ? AppColors.primary.withOpacity(0.08)
                                      : Colors.transparent,
                                  child: Text(
                                    tmpl.name,
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      fontSize: 9,
                                      fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                                      color: selected ? AppColors.primary : context.appTextMuted,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),

          // ── Bouton export ──
          Padding(
            padding: EdgeInsets.fromLTRB(16, 8, 16, bottomPad + 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_sendError != null) ...[
                  Text(
                    _sendError!,
                    style: TextStyle(
                      color: AppColors.statusOverdue,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _generating ? null : _confirm,
                    icon: _generating
                        ? const SizedBox(
                            width: 16, height: 16,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : Icon(
                            widget.mode == TemplateSelectorMode.sendEmail
                                ? Icons.send_rounded
                                : Icons.picture_as_pdf_rounded,
                            size: 18,
                          ),
                    label: Text(_generating
                        ? 'Génération…'
                        : widget.mode == TemplateSelectorMode.sendEmail
                            ? 'Envoyer ce modèle'
                            : 'Exporter ce modèle'),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
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

class _TemplatePreviewPage extends StatelessWidget {
  final QuoteTemplate template;
  final Future<Uint8List> Function() buildPreview;
  final Future<void> Function() onExport;
  final bool generating;
  final TemplateSelectorMode mode;

  const _TemplatePreviewPage({
    required this.template,
    required this.buildPreview,
    required this.onExport,
    required this.generating,
    required this.mode,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFE8E8E8),
      appBar: AppBar(
        backgroundColor: context.appSurface,
        foregroundColor: context.appText,
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              template.name,
              style: TextStyle(
                color: context.appText,
                fontSize: 15,
                fontWeight: FontWeight.w700,
              ),
            ),
            Text(
              template.category,
              style: TextStyle(
                color: context.appTextMuted,
                fontSize: 11,
              ),
            ),
          ],
        ),
      ),
      body: PdfPreview(
        key: ValueKey(template.id),
        build: (_) => buildPreview(),
        useActions: false,
        canChangePageFormat: false,
        canChangeOrientation: false,
        canDebug: false,
        allowPrinting: false,
        allowSharing: false,
        scrollViewDecoration: const BoxDecoration(color: Color(0xFFE8E8E8)),
        pdfPreviewPageDecoration: BoxDecoration(
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.18),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        loadingWidget: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(
                color: AppColors.primary,
                strokeWidth: 2.5,
              ),
              const SizedBox(height: 10),
              Text(
                'Génération de l\'aperçu…',
                style: TextStyle(fontSize: 12, color: Colors.grey[600]),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
          decoration: BoxDecoration(
            color: context.appSurface,
            border: Border(top: BorderSide(color: context.appBorder)),
          ),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: context.appText,
                    side: BorderSide(color: context.appBorderStrong),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 13),
                  ),
                  child: const Text('Fermer'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: generating ? null : onExport,
                  icon: generating
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : Icon(
                          mode == TemplateSelectorMode.sendEmail
                              ? Icons.send_rounded
                              : Icons.picture_as_pdf_rounded,
                          size: 18,
                        ),
                  label: Text(generating
                      ? 'Génération…'
                      : mode == TemplateSelectorMode.sendEmail
                          ? 'Envoyer'
                          : 'Exporter'),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
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

// ─── Miniature Flutter (grille de sélection) ─────────────────────────────────

class _TemplateThumbnail extends StatelessWidget {
  final QuoteTemplate tmpl;
  const _TemplateThumbnail({required this.tmpl});

  Color _hex(String h) {
    final s = h.replaceFirst('#', '');
    return Color(int.parse('FF$s', radix: 16));
  }

  @override
  Widget build(BuildContext context) {
    final primary = _hex(tmpl.primary);
    final accent  = tmpl.accent != null ? _hex(tmpl.accent!) : primary;
    final billBg  = tmpl.billBg != null ? _hex(tmpl.billBg!) : const Color(0xFFF5F4EE);

    switch (tmpl.layout) {
      case QuoteLayoutType.a:
        return _ThumbnailA(primary: primary, billBg: billBg);
      case QuoteLayoutType.b:
        return _ThumbnailB(headerBg: primary, accent: accent);
      case QuoteLayoutType.c:
        return _ThumbnailC(accent: primary);
      case QuoteLayoutType.d:
        return _ThumbnailD(sidebarBg: primary, accent: accent);
      case QuoteLayoutType.e:
        final rowBg = tmpl.headerRowBg != null ? _hex(tmpl.headerRowBg!) : primary;
        final stripeBg = tmpl.stripeBg != null ? _hex(tmpl.stripeBg!) : const Color(0xFFF8FAFC);
        return _ThumbnailE(primary: primary, headerRowBg: rowBg, stripeBg: stripeBg);
      case QuoteLayoutType.f:
        return _ThumbnailF(accent: primary);
    }
  }
}

// ── Thumbnail A : Classique ──

class _ThumbnailA extends StatelessWidget {
  final Color primary;
  final Color billBg;
  const _ThumbnailA({required this.primary, required this.billBg});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(7),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(width: 12, height: 12, decoration: BoxDecoration(color: primary, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 3),
            Container(height: 3, width: 36, color: const Color(0xFF333333)),
            const SizedBox(height: 2),
            Container(height: 1.5, width: 38, color: const Color(0xFFDDDDDD)),
          ]),
          const Spacer(),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Container(height: 7, width: 26, decoration: BoxDecoration(color: primary, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 2),
            Container(height: 1.5, width: 20, color: const Color(0xFFCCCCCC)),
            const SizedBox(height: 3),
            Container(height: 1.5, width: 30, color: const Color(0xFFDDDDDD)),
            const SizedBox(height: 1.5),
            Container(height: 1.5, width: 26, color: const Color(0xFFDDDDDD)),
          ]),
        ]),
        const SizedBox(height: 5),
        Container(
          decoration: BoxDecoration(color: billBg, borderRadius: BorderRadius.circular(3)),
          padding: const EdgeInsets.all(4),
          child: Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(height: 1.5, width: 22, color: const Color(0xFFBBBBBB)),
              const SizedBox(height: 2),
              Container(height: 3, width: 32, color: const Color(0xFF444444)),
            ])),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(height: 1.5, width: 18, color: const Color(0xFFBBBBBB)),
              const SizedBox(height: 2),
              Container(height: 3, width: 28, color: const Color(0xFF444444)),
            ])),
          ]),
        ),
        const SizedBox(height: 5),
        Container(height: 1.5, color: primary),
        ...[0, 1, 2].map((i) => Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Row(children: [
            Expanded(child: Container(height: 1.5, color: const Color(0xFFDDDDDD))),
            const SizedBox(width: 2),
            Container(height: 1.5, width: 14, color: const Color(0xFFDDDDDD)),
            const SizedBox(width: 2),
            Container(height: 1.5, width: 14, color: const Color(0xFFBBBBBB)),
          ]),
        )),
        const Spacer(),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Container(height: 1, width: 28, color: const Color(0xFFE5E5E5)),
          Container(height: 1, width: 8, color: const Color(0xFFE5E5E5)),
        ]),
      ]),
    );
  }
}

// ── Thumbnail B : Dynamique ──

class _ThumbnailB extends StatelessWidget {
  final Color headerBg;
  final Color accent;
  const _ThumbnailB({required this.headerBg, required this.accent});

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Container(
        color: headerBg,
        padding: const EdgeInsets.all(7),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(width: 12, height: 12, decoration: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 3),
            Container(height: 3, width: 32, color: Colors.white),
            const SizedBox(height: 2),
            Container(height: 1.5, width: 36, color: Colors.white24),
          ]),
          const Spacer(),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Container(height: 7, width: 26, decoration: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 2),
            Container(height: 1.5, width: 20, color: Colors.white38),
            const SizedBox(height: 3),
            Container(height: 1.5, width: 30, color: Colors.white24),
          ]),
        ]),
      ),
      Expanded(
        child: Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(7, 5, 7, 7),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              decoration: BoxDecoration(color: const Color(0xFFF5F4EE), borderRadius: BorderRadius.circular(2)),
              padding: const EdgeInsets.all(3),
              child: Row(children: [
                Expanded(child: Container(height: 2.5, color: const Color(0xFF444444))),
                const SizedBox(width: 4),
                Expanded(child: Container(height: 2.5, color: const Color(0xFF444444))),
              ]),
            ),
            const SizedBox(height: 4),
            Container(height: 1.5, color: headerBg),
            ...[0, 1, 2].map((i) => Padding(
              padding: const EdgeInsets.only(top: 3),
              child: Row(children: [
                Expanded(child: Container(height: 1.5, color: const Color(0xFFDDDDDD))),
                const SizedBox(width: 2),
                Container(height: 1.5, width: 12, color: const Color(0xFFBBBBBB)),
              ]),
            )),
            const Spacer(),
            Row(mainAxisAlignment: MainAxisAlignment.end, children: [
              Container(height: 4, width: 18, decoration: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(2))),
            ]),
          ]),
        ),
      ),
    ]);
  }
}

// ── Thumbnail C : Épuré ──

class _ThumbnailC extends StatelessWidget {
  final Color accent;
  const _ThumbnailC({required this.accent});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(7),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(height: 5, width: 38, decoration: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 2),
            Container(height: 1.5, width: 38, color: const Color(0xFFE2E8F0)),
          ]),
          const Spacer(),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Container(height: 7, width: 26, decoration: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 2),
            Container(height: 1.5, width: 20, color: const Color(0xFFE2E8F0)),
            const SizedBox(height: 3),
            Container(height: 1.5, width: 30, color: const Color(0xFFE2E8F0)),
          ]),
        ]),
        const SizedBox(height: 5),
        Container(height: 2, color: accent),
        const SizedBox(height: 5),
        Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(height: 1.5, width: 22, color: accent.withOpacity(0.7)),
            const SizedBox(height: 2),
            Container(height: 3, width: 32, color: const Color(0xFF333333)),
          ])),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(height: 1.5, width: 18, color: accent.withOpacity(0.7)),
            const SizedBox(height: 2),
            Container(height: 3, width: 28, color: const Color(0xFF333333)),
          ])),
        ]),
        const SizedBox(height: 5),
        Container(height: 1, color: const Color(0xFFE2E8F0)),
        Container(height: 1.5, color: accent),
        ...[0, 1, 2].map((i) => Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Row(children: [
            Expanded(child: Container(height: 1.5, color: const Color(0xFFDDDDDD))),
            const SizedBox(width: 2),
            Container(height: 1.5, width: 14, color: const Color(0xFFDDDDDD)),
            const SizedBox(width: 2),
            Container(height: 1.5, width: 14, color: const Color(0xFFBBBBBB)),
          ]),
        )),
        const Spacer(),
        Container(height: 1, color: const Color(0xFFE2E8F0)),
        const SizedBox(height: 3),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Container(height: 1, width: 28, color: const Color(0xFFE5E5E5)),
          Container(height: 1, width: 8, color: const Color(0xFFE5E5E5)),
        ]),
      ]),
    );
  }
}

// ── Thumbnail D : Colonne latérale ──

class _ThumbnailD extends StatelessWidget {
  final Color sidebarBg;
  final Color accent;
  const _ThumbnailD({required this.sidebarBg, required this.accent});

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Container(
        width: 38,
        color: sidebarBg,
        padding: const EdgeInsets.all(5),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(width: 14, height: 14, decoration: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(3))),
          const SizedBox(height: 6),
          Container(height: 3, width: 28, color: Colors.white),
          const SizedBox(height: 2),
          Container(height: 1.5, width: 30, color: Colors.white24),
          const SizedBox(height: 6),
          Container(height: 0.5, color: accent.withOpacity(0.4)),
          const SizedBox(height: 4),
          Container(height: 1.5, width: 20, color: accent),
          const SizedBox(height: 2),
          Container(height: 2.5, width: 28, color: Colors.white70),
          const SizedBox(height: 6),
          Container(height: 0.5, color: accent.withOpacity(0.4)),
          const SizedBox(height: 4),
          Container(height: 1.5, width: 16, color: accent),
          const SizedBox(height: 2),
          Container(height: 2, width: 26, color: Colors.white54),
          const SizedBox(height: 2),
          Container(height: 2, width: 26, color: Colors.white54),
        ]),
      ),
      Expanded(
        child: Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(6, 7, 6, 7),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(height: 6, width: 36, decoration: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 4),
            Container(height: 2.5, width: 48, color: const Color(0xFF333333)),
            const SizedBox(height: 6),
            Container(height: 1.5, color: accent),
            ...[0, 1, 2].map((i) => Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(children: [
                Expanded(child: Container(height: 1.5, color: const Color(0xFFDDDDDD))),
                const SizedBox(width: 2),
                Container(height: 1.5, width: 14, color: const Color(0xFFBBBBBB)),
              ]),
            )),
            const Spacer(),
            Align(
              alignment: Alignment.centerRight,
              child: Container(height: 4, width: 20, decoration: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(2))),
            ),
          ]),
        ),
      ),
    ]);
  }
}

// ── Thumbnail E : Corporate (header coloré + zèbre) ──

class _ThumbnailE extends StatelessWidget {
  final Color primary;
  final Color headerRowBg;
  final Color stripeBg;
  const _ThumbnailE({required this.primary, required this.headerRowBg, required this.stripeBg});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(7),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(width: 12, height: 12, decoration: BoxDecoration(color: primary, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 3),
            Container(height: 3, width: 36, color: const Color(0xFF333333)),
            const SizedBox(height: 2),
            Container(height: 1.5, width: 38, color: const Color(0xFFDDDDDD)),
          ]),
          const Spacer(),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            // Bloc coloré pour DEVIS
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
              decoration: BoxDecoration(color: primary, borderRadius: BorderRadius.circular(2)),
              child: Container(height: 5, width: 22, color: Colors.white.withOpacity(0.9)),
            ),
            const SizedBox(height: 3),
            Container(height: 1.5, width: 20, color: const Color(0xFFCCCCCC)),
            const SizedBox(height: 3),
            Container(height: 1.5, width: 30, color: const Color(0xFFDDDDDD)),
          ]),
        ]),
        const SizedBox(height: 5),
        Container(
          decoration: BoxDecoration(color: const Color(0xFFF5F5F5), borderRadius: BorderRadius.circular(3)),
          padding: const EdgeInsets.all(4),
          child: Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(height: 1.5, width: 22, color: const Color(0xFFBBBBBB)),
              const SizedBox(height: 2),
              Container(height: 3, width: 32, color: const Color(0xFF444444)),
            ])),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(height: 1.5, width: 18, color: const Color(0xFFBBBBBB)),
              const SizedBox(height: 2),
              Container(height: 3, width: 28, color: const Color(0xFF444444)),
            ])),
          ]),
        ),
        const SizedBox(height: 5),
        // Header ligne colorée
        Container(
          decoration: BoxDecoration(color: headerRowBg, borderRadius: BorderRadius.circular(2)),
          padding: const EdgeInsets.symmetric(vertical: 3, horizontal: 3),
          child: Row(children: [
            Expanded(child: Container(height: 1.5, color: Colors.white.withOpacity(0.8))),
            const SizedBox(width: 2),
            Container(height: 1.5, width: 12, color: Colors.white.withOpacity(0.8)),
            const SizedBox(width: 2),
            Container(height: 1.5, width: 12, color: Colors.white.withOpacity(0.8)),
          ]),
        ),
        ...[0, 1, 2].map((i) => Container(
          color: i.isOdd ? stripeBg : Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 3, horizontal: 3),
          child: Row(children: [
            Expanded(child: Container(height: 1.5, color: const Color(0xFFDDDDDD))),
            const SizedBox(width: 2),
            Container(height: 1.5, width: 12, color: const Color(0xFFDDDDDD)),
            const SizedBox(width: 2),
            Container(height: 1.5, width: 12, color: const Color(0xFFBBBBBB)),
          ]),
        )),
        const Spacer(),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Container(height: 1, width: 28, color: const Color(0xFFE5E5E5)),
          Container(height: 1, width: 8, color: const Color(0xFFE5E5E5)),
        ]),
      ]),
    );
  }
}

// ── Thumbnail F : Épuré barre gauche ──

class _ThumbnailF extends StatelessWidget {
  final Color accent;
  const _ThumbnailF({required this.accent});

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Container(width: 4, color: accent),
      Expanded(
        child: Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(6, 7, 7, 7),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Container(width: 11, height: 11, decoration: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(2))),
                const SizedBox(height: 3),
                Container(height: 3, width: 34, color: const Color(0xFF333333)),
                const SizedBox(height: 2),
                Container(height: 1.5, width: 36, color: const Color(0xFFDDDDDD)),
              ]),
              const Spacer(),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Container(height: 7, width: 24, color: const Color(0xFF1e293b)),
                const SizedBox(height: 2),
                Container(height: 1.5, width: 18, color: accent),
                const SizedBox(height: 3),
                Container(height: 1.5, width: 28, color: const Color(0xFFDDDDDD)),
              ]),
            ]),
            const SizedBox(height: 4),
            Container(height: 1, color: const Color(0xFFE2E8F0)),
            const SizedBox(height: 4),
            Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Container(height: 1.5, width: 20, color: accent),
                const SizedBox(height: 2),
                Container(height: 3, width: 30, color: const Color(0xFF333333)),
              ])),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Container(height: 1.5, width: 16, color: accent),
                const SizedBox(height: 2),
                Container(height: 3, width: 26, color: const Color(0xFF333333)),
              ])),
            ]),
            const SizedBox(height: 5),
            Container(height: 1, color: const Color(0xFF334155)),
            ...[0, 1, 2].map((i) => Padding(
              padding: const EdgeInsets.only(top: 3),
              child: Row(children: [
                Expanded(child: Container(height: 1.5, color: const Color(0xFFDDDDDD))),
                const SizedBox(width: 2),
                Container(height: 1.5, width: 12, color: const Color(0xFFBBBBBB)),
              ]),
            )),
            const Spacer(),
            Row(mainAxisAlignment: MainAxisAlignment.end, children: [
              Container(height: 4, width: 18, decoration: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(2))),
            ]),
          ]),
        ),
      ),
    ]);
  }
}
