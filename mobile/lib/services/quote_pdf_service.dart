import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import '../models/quote.dart';

// ─── Template definitions ─────────────────────────────────────────────────────

enum QuoteLayoutType { a, b, c, d, e, f }

class QuoteTemplate {
  final String id;
  final String name;
  final String category; // 'classique', 'dynamique', 'épuré', 'moderne'
  final QuoteLayoutType layout;
  final String primary;
  final String? accent;
  final String? billBg;
  // Layout E specific
  final String? headerRowBg;
  final String? headerRowText;
  final String? stripeBg;

  const QuoteTemplate({
    required this.id,
    required this.name,
    required this.category,
    required this.layout,
    required this.primary,
    this.accent,
    this.billBg,
    this.headerRowBg,
    this.headerRowText,
    this.stripeBg,
  });
}

const List<QuoteTemplate> kQuoteTemplates = [
  // ── Classique ──────────────────────────────────────────────────────────────
  QuoteTemplate(id: 'classique',   name: 'Classique',   category: 'classique',  layout: QuoteLayoutType.a, primary: '#0F8F65', billBg: '#F5F4EE'),
  QuoteTemplate(id: 'marine',      name: 'Marine',      category: 'classique',  layout: QuoteLayoutType.a, primary: '#1e3a5f', billBg: '#EEF3FB'),
  QuoteTemplate(id: 'bordeaux',    name: 'Bordeaux',    category: 'classique',  layout: QuoteLayoutType.a, primary: '#9b1c1c', billBg: '#FEF2F2'),
  QuoteTemplate(id: 'or',          name: 'Or',          category: 'classique',  layout: QuoteLayoutType.a, primary: '#b45309', billBg: '#FFFBEB'),
  QuoteTemplate(id: 'anthracite',  name: 'Anthracite',  category: 'classique',  layout: QuoteLayoutType.a, primary: '#374151', billBg: '#F9FAFB'),
  QuoteTemplate(id: 'prune',       name: 'Prune',       category: 'classique',  layout: QuoteLayoutType.a, primary: '#6d28d9', billBg: '#F5F3FF'),
  QuoteTemplate(id: 'sable',       name: 'Sable',       category: 'classique',  layout: QuoteLayoutType.a, primary: '#78716c', billBg: '#FAFAF9'),
  QuoteTemplate(id: 'encre',       name: 'Encre',       category: 'classique',  layout: QuoteLayoutType.a, primary: '#0c4a6e', billBg: '#F0F9FF'),
  // ── Dynamique ──────────────────────────────────────────────────────────────
  QuoteTemplate(id: 'nuit',        name: 'Nuit Dorée',  category: 'dynamique',  layout: QuoteLayoutType.b, primary: '#0f172a', accent: '#f59e0b', billBg: '#F8F8F4'),
  QuoteTemplate(id: 'ocean',       name: 'Océan',       category: 'dynamique',  layout: QuoteLayoutType.b, primary: '#1e40af', accent: '#93c5fd', billBg: '#EFF6FF'),
  QuoteTemplate(id: 'foret',       name: 'Forêt',       category: 'dynamique',  layout: QuoteLayoutType.b, primary: '#14532d', accent: '#86efac', billBg: '#F0FDF4'),
  QuoteTemplate(id: 'violet',      name: 'Violet',      category: 'dynamique',  layout: QuoteLayoutType.b, primary: '#4c1d95', accent: '#c4b5fd', billBg: '#F5F3FF'),
  QuoteTemplate(id: 'rubis',       name: 'Rubis',       category: 'dynamique',  layout: QuoteLayoutType.b, primary: '#be123c', accent: '#fecdd3', billBg: '#FFF1F2'),
  QuoteTemplate(id: 'teal-vif',    name: 'Teal',        category: 'dynamique',  layout: QuoteLayoutType.b, primary: '#0f766e', accent: '#5eead4', billBg: '#F0FDFA'),
  QuoteTemplate(id: 'amber',       name: 'Ambre',       category: 'dynamique',  layout: QuoteLayoutType.b, primary: '#92400e', accent: '#fbbf24', billBg: '#FFFBEB'),
  QuoteTemplate(id: 'ardoise-header', name: 'Ardoise',  category: 'dynamique',  layout: QuoteLayoutType.b, primary: '#334155', accent: '#e2e8f0', billBg: '#F8FAFC'),
  // ── Épuré ──────────────────────────────────────────────────────────────────
  QuoteTemplate(id: 'ardoise',     name: 'Ardoise',     category: 'épuré',      layout: QuoteLayoutType.c, primary: '#475569'),
  QuoteTemplate(id: 'corail',      name: 'Corail',      category: 'épuré',      layout: QuoteLayoutType.c, primary: '#e11d48'),
  QuoteTemplate(id: 'emeraude',    name: 'Émeraude',    category: 'épuré',      layout: QuoteLayoutType.c, primary: '#059669'),
  QuoteTemplate(id: 'indigo',      name: 'Indigo',      category: 'épuré',      layout: QuoteLayoutType.c, primary: '#4338ca'),
  QuoteTemplate(id: 'bronze',      name: 'Bronze',      category: 'épuré',      layout: QuoteLayoutType.c, primary: '#92400e'),
  QuoteTemplate(id: 'barre-rose',  name: 'Barre Rose',  category: 'épuré',      layout: QuoteLayoutType.f, primary: '#db2777'),
  QuoteTemplate(id: 'barre-teal',  name: 'Barre Teal',  category: 'épuré',      layout: QuoteLayoutType.f, primary: '#0891b2'),
  // ── Moderne ────────────────────────────────────────────────────────────────
  QuoteTemplate(id: 'sidebar-nuit',     name: 'Colonne Nuit',     category: 'moderne', layout: QuoteLayoutType.d, primary: '#1e293b', accent: '#38bdf8'),
  QuoteTemplate(id: 'sidebar-vert',     name: 'Colonne Vert',     category: 'moderne', layout: QuoteLayoutType.d, primary: '#064e3b', accent: '#6ee7b7'),
  QuoteTemplate(id: 'sidebar-bordeaux', name: 'Colonne Rouge',    category: 'moderne', layout: QuoteLayoutType.d, primary: '#7f1d1d', accent: '#fca5a5'),
  QuoteTemplate(id: 'corp-bleu',        name: 'Corporate Bleu',   category: 'moderne', layout: QuoteLayoutType.e, primary: '#1e40af', headerRowBg: '#1e40af', headerRowText: '#FFFFFF', stripeBg: '#EFF6FF', billBg: '#F0F7FF'),
  QuoteTemplate(id: 'corp-sombre',      name: 'Corporate Nuit',   category: 'moderne', layout: QuoteLayoutType.e, primary: '#f59e0b', headerRowBg: '#0f172a', headerRowText: '#FFFFFF', stripeBg: '#F8FAFC', billBg: '#F1F5F9'),
  QuoteTemplate(id: 'corp-vert',        name: 'Corporate Vert',   category: 'moderne', layout: QuoteLayoutType.e, primary: '#059669', headerRowBg: '#059669', headerRowText: '#FFFFFF', stripeBg: '#F0FDF4', billBg: '#F0FDF4'),
  QuoteTemplate(id: 'corp-rouge',       name: 'Corporate Rouge',  category: 'moderne', layout: QuoteLayoutType.e, primary: '#dc2626', headerRowBg: '#dc2626', headerRowText: '#FFFFFF', stripeBg: '#FEF2F2', billBg: '#FFF5F5'),
];

// ─── PDF Service ──────────────────────────────────────────────────────────────

class QuotePdfService {
  static PdfColor _c(String hex) => PdfColor.fromHex(hex);

  static final _dark       = PdfColor.fromHex('#14201C');
  static final _muted      = PdfColor.fromHex('#6B7570');
  static final _lightBorder = PdfColor.fromHex('#E8E6DD');
  static final _slateGray  = PdfColor.fromHex('#94a3b8');
  static final _slateMid   = PdfColor.fromHex('#64748b');
  static final _slateDark  = PdfColor.fromHex('#334155');
  static final _border     = PdfColor.fromHex('#e2e8f0');

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

  static String _fmtDate(DateTime? d) {
    if (d == null) return '—';
    const months = ['jan.','fév.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
    return '${d.day.toString().padLeft(2, '0')} ${months[d.month - 1]} ${d.year}';
  }

  static String _validUntil(DateTime? issuedAt, int validDays) {
    final base = issuedAt ?? DateTime.now();
    return _fmtDate(base.add(Duration(days: validDays)));
  }

  static String _initial(Quote quote) {
    final s = quote.user?.companyName ?? quote.user?.name ?? 'D';
    return s.isNotEmpty ? s[0].toUpperCase() : 'D';
  }

  // ─── Shared helpers ─────────────────────────────────────────────────────

  static pw.Widget _logoBlock(pw.ImageProvider? logo, String initial, PdfColor bgColor, PdfColor textColor, double size) {
    if (logo != null) {
      return pw.ClipRRect(
        horizontalRadius: 8, verticalRadius: 8,
        child: pw.Image(logo, width: size, height: size, fit: pw.BoxFit.cover),
      );
    }
    return pw.Container(
      width: size, height: size,
      decoration: pw.BoxDecoration(color: bgColor, borderRadius: const pw.BorderRadius.all(pw.Radius.circular(8))),
      alignment: pw.Alignment.center,
      child: pw.Text(initial, style: pw.TextStyle(color: textColor, fontSize: size * 0.4, fontWeight: pw.FontWeight.bold)),
    );
  }

  static pw.Widget _tableHeader(PdfColor accentColor) {
    return pw.Container(
      decoration: pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(color: accentColor, width: 2))),
      padding: const pw.EdgeInsets.only(bottom: 6),
      child: pw.Row(children: [
        pw.Expanded(child: pw.Text('Désignation', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: accentColor, letterSpacing: 1))),
        pw.SizedBox(width: 36, child: pw.Text('Qté', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: accentColor), textAlign: pw.TextAlign.right)),
        pw.SizedBox(width: 80, child: pw.Text('P.U.', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: accentColor), textAlign: pw.TextAlign.right)),
        pw.SizedBox(width: 85, child: pw.Text('Total HT', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: accentColor), textAlign: pw.TextAlign.right)),
      ]),
    );
  }

  static List<pw.Widget> _tableRows(List<QuoteItem> items) {
    return items.map((it) => pw.Container(
      decoration: pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(color: _lightBorder, width: 1))),
      padding: const pw.EdgeInsets.symmetric(vertical: 8),
      child: pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Expanded(child: pw.Text(it.description, style: pw.TextStyle(fontSize: 10, color: _dark))),
        pw.SizedBox(width: 36, child: pw.Text('${it.quantity.toInt()}', style: pw.TextStyle(fontSize: 10, color: _dark), textAlign: pw.TextAlign.right)),
        pw.SizedBox(width: 80, child: pw.Text(_fmtXOF(it.unitPrice), style: pw.TextStyle(fontSize: 10, color: _dark), textAlign: pw.TextAlign.right)),
        pw.SizedBox(width: 85, child: pw.Text(_fmtXOF(it.total), style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold, color: _dark), textAlign: pw.TextAlign.right)),
      ]),
    )).toList();
  }

  // Table rows with zebra stripes (layout E)
  static List<pw.Widget> _tableRowsZebra(List<QuoteItem> items, PdfColor stripeBg) {
    return items.asMap().entries.map((e) {
      final i = e.key;
      final it = e.value;
      return pw.Container(
        color: i.isOdd ? stripeBg : PdfColors.white,
        padding: const pw.EdgeInsets.symmetric(vertical: 9, horizontal: 6),
        child: pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.Expanded(child: pw.Text(it.description, style: pw.TextStyle(fontSize: 10, color: _dark))),
          pw.SizedBox(width: 36, child: pw.Text('${it.quantity.toInt()}', style: pw.TextStyle(fontSize: 10, color: _dark), textAlign: pw.TextAlign.right)),
          pw.SizedBox(width: 80, child: pw.Text(_fmtXOF(it.unitPrice), style: pw.TextStyle(fontSize: 10, color: _dark), textAlign: pw.TextAlign.right)),
          pw.SizedBox(width: 85, child: pw.Text(_fmtXOF(it.total), style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold, color: _dark), textAlign: pw.TextAlign.right)),
        ]),
      );
    }).toList();
  }

  static pw.Widget _totals(Quote quote, PdfColor accentColor) {
    return pw.Align(
      alignment: pw.Alignment.centerRight,
      child: pw.SizedBox(
        width: 230,
        child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.stretch, children: [
          pw.SizedBox(height: 12),
          _totalRow('Sous-total HT', _fmtXOF(quote.subtotal), _muted, _dark),
          pw.SizedBox(height: 4),
          _totalRow('TVA ${quote.taxRate.toInt()} %', _fmtXOF(quote.taxAmount), _muted, _dark),
          if (quote.discount > 0) ...[
            pw.SizedBox(height: 4),
            _totalRow('Remise', '- ${_fmtXOF(quote.discount)}', _muted, PdfColor.fromHex('#ef4444')),
          ],
          pw.SizedBox(height: 6),
          pw.Container(height: 1, color: accentColor),
          pw.SizedBox(height: 6),
          pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
            pw.Text('Total TTC', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold, color: _dark)),
            pw.Text(_fmtXOF(quote.total), style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold, color: accentColor)),
          ]),
        ]),
      ),
    );
  }

  static pw.Widget _totalRow(String label, String value, PdfColor labelColor, PdfColor valueColor) {
    return pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
      pw.Text(label, style: pw.TextStyle(fontSize: 10, color: labelColor)),
      pw.Text(value, style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold, color: valueColor)),
    ]);
  }

  static pw.Widget _notesBox(String notes, PdfColor bgColor) {
    return pw.Container(
      decoration: pw.BoxDecoration(color: bgColor, borderRadius: const pw.BorderRadius.all(pw.Radius.circular(8))),
      padding: const pw.EdgeInsets.all(12),
      child: pw.RichText(text: pw.TextSpan(children: [
        pw.TextSpan(text: 'Conditions de paiement.  ', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: _dark)),
        pw.TextSpan(text: notes, style: pw.TextStyle(fontSize: 9, color: _muted)),
      ])),
    );
  }

  static pw.Widget _footer(Quote quote) {
    final u = quote.user;
    final company = u?.companyName ?? u?.name ?? '';
    final extra = [
      if (u?.rccm != null) 'RCCM ${u!.rccm}',
      if (u?.ifu != null) 'IFU ${u!.ifu}',
    ].join(' · ');
    final left = [company, if (extra.isNotEmpty) extra].join(' · ');
    return pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
      pw.Text(left, style: pw.TextStyle(fontSize: 8, color: _muted)),
      pw.Text('Page 1/1', style: pw.TextStyle(fontSize: 8, color: _muted)),
    ]);
  }

  static pw.Widget _billToBox(Quote quote, PdfColor billBg) {
    final client = quote.client;
    return pw.Container(
      decoration: pw.BoxDecoration(color: billBg, borderRadius: const pw.BorderRadius.all(pw.Radius.circular(8))),
      padding: const pw.EdgeInsets.all(14),
      child: pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Expanded(child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.Text('ADRESSÉ À', style: pw.TextStyle(fontSize: 8, color: _muted, letterSpacing: 1)),
          pw.SizedBox(height: 3),
          pw.Text(client?.name ?? '—', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold, color: _dark)),
        ])),
        pw.Expanded(child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.Text('OBJET', style: pw.TextStyle(fontSize: 8, color: _muted, letterSpacing: 1)),
          pw.SizedBox(height: 3),
          pw.Text(quote.title, style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold, color: _dark)),
        ])),
      ]),
    );
  }

  // ─── Layout A : Classique ────────────────────────────────────────────────

  static pw.Widget _layoutA(Quote quote, QuoteTemplate tmpl, pw.ImageProvider? logo) {
    final primary = _c(tmpl.primary);
    final billBg  = _c(tmpl.billBg ?? '#F5F4EE');
    final u = quote.user;
    return pw.Padding(
      padding: const pw.EdgeInsets.all(40),
      child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.Expanded(child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            _logoBlock(logo, _initial(quote), primary, PdfColors.white, 40),
            pw.SizedBox(height: 8),
            pw.Text(u?.companyName ?? u?.name ?? 'Mon Entreprise', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold, color: _dark)),
            pw.SizedBox(height: 4),
            pw.Text([u?.address ?? 'Bénin', if (u?.phone != null) u!.phone!, if (u?.email != null) u!.email!].join('\n'), style: pw.TextStyle(fontSize: 9, color: _muted, lineSpacing: 3)),
          ])),
          pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
            pw.Text('DEVIS', style: pw.TextStyle(fontSize: 24, fontWeight: pw.FontWeight.bold, color: primary)),
            pw.SizedBox(height: 2),
            pw.Text(quote.number, style: pw.TextStyle(fontSize: 11, color: _muted)),
            pw.SizedBox(height: 10),
            pw.Text('Émis le ${_fmtDate(quote.issuedAt ?? quote.createdAt)}', style: pw.TextStyle(fontSize: 9, color: _muted)),
            pw.SizedBox(height: 2),
            pw.Text("Valable jusqu'au ${_validUntil(quote.issuedAt, quote.validDays)}", style: pw.TextStyle(fontSize: 9, color: _muted)),
          ]),
        ]),
        pw.SizedBox(height: 20),
        _billToBox(quote, billBg),
        pw.SizedBox(height: 20),
        _tableHeader(primary),
        ..._tableRows(quote.items),
        _totals(quote, primary),
        if (quote.notes != null && quote.notes!.isNotEmpty) ...[
          pw.SizedBox(height: 20), _notesBox(quote.notes!, billBg),
        ],
        pw.Spacer(),
        _footer(quote),
      ]),
    );
  }

  // ─── Layout B : Bannière colorée ─────────────────────────────────────────

  static pw.Widget _layoutB(Quote quote, QuoteTemplate tmpl, pw.ImageProvider? logo) {
    final headerBg  = _c(tmpl.primary);
    final accent    = _c(tmpl.accent ?? tmpl.primary);
    final billBg    = _c(tmpl.billBg ?? '#F5F4EE');
    final u = quote.user;
    final mutedWhite = PdfColor.fromHex('#8ba09a');
    return pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
      pw.Container(
        color: headerBg,
        padding: const pw.EdgeInsets.fromLTRB(40, 28, 40, 24),
        child: pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.Expanded(child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            _logoBlock(logo, _initial(quote), accent, headerBg, 44),
            pw.SizedBox(height: 8),
            pw.Text(u?.companyName ?? u?.name ?? 'Mon Entreprise', style: pw.TextStyle(fontSize: 13, fontWeight: pw.FontWeight.bold, color: PdfColors.white)),
            pw.SizedBox(height: 4),
            pw.Text([u?.address ?? 'Bénin', if (u?.phone != null) u!.phone!, if (u?.email != null) u!.email!].join('\n'), style: pw.TextStyle(fontSize: 9, color: mutedWhite, lineSpacing: 3)),
          ])),
          pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
            pw.Text('DEVIS', style: pw.TextStyle(fontSize: 26, fontWeight: pw.FontWeight.bold, color: accent)),
            pw.SizedBox(height: 2),
            pw.Text(quote.number, style: pw.TextStyle(fontSize: 11, color: mutedWhite)),
            pw.SizedBox(height: 10),
            pw.Text('Émis le ${_fmtDate(quote.issuedAt ?? quote.createdAt)}', style: pw.TextStyle(fontSize: 9, color: mutedWhite)),
            pw.SizedBox(height: 2),
            pw.Text("Valable jusqu'au ${_validUntil(quote.issuedAt, quote.validDays)}", style: pw.TextStyle(fontSize: 9, color: mutedWhite)),
          ]),
        ]),
      ),
      pw.Expanded(
        child: pw.Padding(
          padding: const pw.EdgeInsets.fromLTRB(40, 20, 40, 30),
          child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            _billToBox(quote, billBg),
            pw.SizedBox(height: 18),
            _tableHeader(headerBg),
            ..._tableRows(quote.items),
            _totals(quote, accent),
            if (quote.notes != null && quote.notes!.isNotEmpty) ...[
              pw.SizedBox(height: 20), _notesBox(quote.notes!, billBg),
            ],
            pw.Spacer(),
            _footer(quote),
          ]),
        ),
      ),
    ]);
  }

  // ─── Layout C : Épuré typographie ────────────────────────────────────────

  static pw.Widget _layoutC(Quote quote, QuoteTemplate tmpl, pw.ImageProvider? logo) {
    final accent = _c(tmpl.primary);
    final u = quote.user;
    final client = quote.client;
    return pw.Padding(
      padding: const pw.EdgeInsets.all(40),
      child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.Expanded(child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            if (logo != null) ...[
              pw.ClipRRect(horizontalRadius: 8, verticalRadius: 8, child: pw.Image(logo, width: 44, height: 44, fit: pw.BoxFit.cover)),
              pw.SizedBox(height: 8),
            ] else ...[
              pw.Container(width: 44, height: 44, decoration: pw.BoxDecoration(color: accent, borderRadius: const pw.BorderRadius.all(pw.Radius.circular(8))), alignment: pw.Alignment.center, child: pw.Text(_initial(quote), style: pw.TextStyle(color: PdfColors.white, fontSize: 17, fontWeight: pw.FontWeight.bold))),
              pw.SizedBox(height: 8),
            ],
            pw.Text(u?.companyName ?? u?.name ?? 'Mon Entreprise', style: pw.TextStyle(fontSize: 15, fontWeight: pw.FontWeight.bold, color: accent)),
            pw.SizedBox(height: 4),
            pw.Text([u?.address ?? 'Bénin', if (u?.phone != null) u!.phone!, if (u?.email != null) u!.email!].join('\n'), style: pw.TextStyle(fontSize: 9, color: _slateGray, lineSpacing: 3)),
          ])),
          pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
            pw.Text('DEVIS', style: pw.TextStyle(fontSize: 26, fontWeight: pw.FontWeight.bold, color: accent)),
            pw.SizedBox(height: 2),
            pw.Text(quote.number, style: pw.TextStyle(fontSize: 10, color: _slateGray)),
            pw.SizedBox(height: 10),
            pw.Text('Émis le ${_fmtDate(quote.issuedAt ?? quote.createdAt)}', style: pw.TextStyle(fontSize: 9, color: _slateGray)),
            pw.SizedBox(height: 2),
            pw.Text("Valable jusqu'au ${_validUntil(quote.issuedAt, quote.validDays)}", style: pw.TextStyle(fontSize: 9, color: _slateGray)),
          ]),
        ]),
        pw.SizedBox(height: 12),
        pw.Container(height: 2, color: accent),
        pw.SizedBox(height: 16),
        pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.Expanded(child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Text('ADRESSÉ À', style: pw.TextStyle(fontSize: 8, color: accent, letterSpacing: 1.5)),
            pw.SizedBox(height: 5),
            pw.Text(client?.name ?? '—', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold, color: _dark)),
          ])),
          pw.Expanded(child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Text('OBJET', style: pw.TextStyle(fontSize: 8, color: accent, letterSpacing: 1.5)),
            pw.SizedBox(height: 5),
            pw.Text(quote.title, style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold, color: _dark)),
          ])),
        ]),
        pw.SizedBox(height: 20),
        pw.Container(height: 1, color: _border),
        pw.SizedBox(height: 8),
        _tableHeader(accent),
        pw.SizedBox(height: 2),
        pw.Container(height: 1.5, color: accent),
        ..._tableRows(quote.items),
        _totals(quote, accent),
        if (quote.notes != null && quote.notes!.isNotEmpty) ...[
          pw.SizedBox(height: 20),
          pw.Container(
            decoration: pw.BoxDecoration(border: pw.Border(left: pw.BorderSide(color: accent, width: 3))),
            padding: const pw.EdgeInsets.only(left: 10),
            child: pw.RichText(text: pw.TextSpan(children: [
              pw.TextSpan(text: 'Conditions de paiement.  ', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: _dark)),
              pw.TextSpan(text: quote.notes!, style: pw.TextStyle(fontSize: 9, color: _slateMid)),
            ])),
          ),
        ],
        pw.Spacer(),
        pw.Container(height: 1, color: _border),
        pw.SizedBox(height: 6),
        _footer(quote),
      ]),
    );
  }

  // ─── Layout D : Colonne latérale ─────────────────────────────────────────

  static pw.Widget _layoutD(Quote quote, QuoteTemplate tmpl, pw.ImageProvider? logo) {
    final sidebarBg = _c(tmpl.primary);
    final accent    = _c(tmpl.accent ?? tmpl.primary);
    final u = quote.user;
    final client = quote.client;
    final sidebarMuted = PdfColor.fromHex('#8ba8a0');
    final sidebarAccentFaint = PdfColor.fromHex('#3a5050');
    return pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.stretch, children: [
      pw.Container(
        width: 155, color: sidebarBg,
        padding: const pw.EdgeInsets.fromLTRB(18, 32, 18, 32),
        child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          _logoBlock(logo, _initial(quote), accent, sidebarBg, 44),
          pw.SizedBox(height: 16),
          pw.Text(u?.companyName ?? u?.name ?? 'Mon Entreprise', style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold, color: PdfColors.white)),
          pw.SizedBox(height: 4),
          pw.Text([u?.address ?? 'Bénin', if (u?.phone != null) u!.phone!, if (u?.email != null) u!.email!].join('\n'), style: pw.TextStyle(fontSize: 8, color: sidebarMuted, lineSpacing: 3)),
          pw.SizedBox(height: 14),
          pw.Container(height: 1, color: sidebarAccentFaint),
          pw.SizedBox(height: 14),
          pw.Text('ADRESSÉ À', style: pw.TextStyle(fontSize: 8, color: accent, letterSpacing: 1.2)),
          pw.SizedBox(height: 5),
          pw.Text(client?.name ?? '—', style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold, color: PdfColors.white)),
          pw.SizedBox(height: 14),
          pw.Container(height: 1, color: sidebarAccentFaint),
          pw.SizedBox(height: 14),
          pw.Text('DATES', style: pw.TextStyle(fontSize: 8, color: accent, letterSpacing: 1.2)),
          pw.SizedBox(height: 5),
          pw.Text('Émis le', style: pw.TextStyle(fontSize: 8, color: sidebarMuted)),
          pw.Text(_fmtDate(quote.issuedAt ?? quote.createdAt), style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: PdfColors.white)),
          pw.SizedBox(height: 6),
          pw.Text("Valable jusqu'au", style: pw.TextStyle(fontSize: 8, color: sidebarMuted)),
          pw.Text(_validUntil(quote.issuedAt, quote.validDays), style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: PdfColors.white)),
        ]),
      ),
      pw.Expanded(
        child: pw.Padding(
          padding: const pw.EdgeInsets.fromLTRB(28, 32, 32, 32),
          child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
              pw.Text('DEVIS', style: pw.TextStyle(fontSize: 26, fontWeight: pw.FontWeight.bold, color: accent)),
              pw.Text(quote.number, style: pw.TextStyle(fontSize: 11, color: _muted)),
            ]),
            pw.SizedBox(height: 12),
            pw.Text(quote.title, style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold, color: _dark)),
            pw.SizedBox(height: 18),
            _tableHeader(accent),
            ..._tableRows(quote.items),
            _totals(quote, accent),
            if (quote.notes != null && quote.notes!.isNotEmpty) ...[
              pw.SizedBox(height: 16),
              pw.Container(
                decoration: pw.BoxDecoration(color: PdfColor.fromHex('#f8fafc'), borderRadius: const pw.BorderRadius.all(pw.Radius.circular(6))),
                padding: const pw.EdgeInsets.all(10),
                child: pw.RichText(text: pw.TextSpan(children: [
                  pw.TextSpan(text: 'Conditions.  ', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: _dark)),
                  pw.TextSpan(text: quote.notes!, style: pw.TextStyle(fontSize: 9, color: _muted)),
                ])),
              ),
            ],
            pw.Spacer(),
            pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
              pw.Text(u?.ifu != null ? 'IFU ${u!.ifu}' : '', style: pw.TextStyle(fontSize: 8, color: _muted)),
              pw.Text('Page 1/1', style: pw.TextStyle(fontSize: 8, color: _muted)),
            ]),
          ]),
        ),
      ),
    ]);
  }

  // ─── Layout E : Corporate — header tableau coloré + zèbre ────────────────

  static pw.Widget _layoutE(Quote quote, QuoteTemplate tmpl, pw.ImageProvider? logo) {
    final primary      = _c(tmpl.primary);
    final headerRowBg  = _c(tmpl.headerRowBg ?? tmpl.primary);
    final headerRowTxt = tmpl.headerRowText == '#FFFFFF' ? PdfColors.white : _c(tmpl.headerRowText ?? '#FFFFFF');
    final stripeBg     = _c(tmpl.stripeBg ?? '#F8FAFC');
    final billBg       = _c(tmpl.billBg ?? '#F5F4EE');
    final u = quote.user;

    return pw.Padding(
      padding: const pw.EdgeInsets.all(40),
      child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.Expanded(child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            _logoBlock(logo, _initial(quote), primary, PdfColors.white, 42),
            pw.SizedBox(height: 8),
            pw.Text(u?.companyName ?? u?.name ?? 'Mon Entreprise', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold, color: _dark)),
            pw.SizedBox(height: 4),
            pw.Text([u?.address ?? 'Bénin', if (u?.phone != null) u!.phone!, if (u?.email != null) u!.email!].join('\n'), style: pw.TextStyle(fontSize: 9, color: _muted, lineSpacing: 3)),
          ])),
          pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
            pw.Container(
              decoration: pw.BoxDecoration(color: primary, borderRadius: const pw.BorderRadius.all(pw.Radius.circular(6))),
              padding: const pw.EdgeInsets.symmetric(vertical: 8, horizontal: 16),
              child: pw.Text('DEVIS', style: pw.TextStyle(fontSize: 20, fontWeight: pw.FontWeight.bold, color: PdfColors.white)),
            ),
            pw.SizedBox(height: 6),
            pw.Text(quote.number, style: pw.TextStyle(fontSize: 11, color: _muted)),
            pw.SizedBox(height: 8),
            pw.Text('Émis le ${_fmtDate(quote.issuedAt ?? quote.createdAt)}', style: pw.TextStyle(fontSize: 9, color: _muted)),
            pw.SizedBox(height: 2),
            pw.Text("Valable jusqu'au ${_validUntil(quote.issuedAt, quote.validDays)}", style: pw.TextStyle(fontSize: 9, color: _muted)),
          ]),
        ]),
        pw.SizedBox(height: 20),
        _billToBox(quote, billBg),
        pw.SizedBox(height: 20),
        // Table header avec fond coloré
        pw.Container(
          decoration: pw.BoxDecoration(
            color: headerRowBg,
            borderRadius: const pw.BorderRadius.all(pw.Radius.circular(4)),
          ),
          padding: const pw.EdgeInsets.symmetric(vertical: 8, horizontal: 6),
          child: pw.Row(children: [
            pw.Expanded(child: pw.Text('Désignation', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: headerRowTxt, letterSpacing: 1))),
            pw.SizedBox(width: 36, child: pw.Text('Qté', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: headerRowTxt), textAlign: pw.TextAlign.right)),
            pw.SizedBox(width: 80, child: pw.Text('P.U.', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: headerRowTxt), textAlign: pw.TextAlign.right)),
            pw.SizedBox(width: 85, child: pw.Text('Total HT', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: headerRowTxt), textAlign: pw.TextAlign.right)),
          ]),
        ),
        ..._tableRowsZebra(quote.items, stripeBg),
        _totals(quote, primary),
        if (quote.notes != null && quote.notes!.isNotEmpty) ...[
          pw.SizedBox(height: 20), _notesBox(quote.notes!, billBg),
        ],
        pw.Spacer(),
        _footer(quote),
      ]),
    );
  }

  // ─── Layout F : Épuré barre gauche ───────────────────────────────────────

  static pw.Widget _layoutF(Quote quote, QuoteTemplate tmpl, pw.ImageProvider? logo) {
    final accent = _c(tmpl.primary);
    final u = quote.user;
    final client = quote.client;

    return pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.stretch, children: [
      // Barre colorée gauche
      pw.Container(width: 5, color: accent),
      // Contenu principal
      pw.Expanded(
        child: pw.Padding(
          padding: const pw.EdgeInsets.fromLTRB(43, 40, 48, 40),
          child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              pw.Expanded(child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                _logoBlock(logo, _initial(quote), accent, PdfColors.white, 38),
                pw.SizedBox(height: 8),
                pw.Text(u?.companyName ?? u?.name ?? 'Mon Entreprise', style: pw.TextStyle(fontSize: 13, fontWeight: pw.FontWeight.bold, color: _dark)),
                pw.SizedBox(height: 4),
                pw.Text([u?.address ?? 'Bénin', if (u?.phone != null) u!.phone!, if (u?.email != null) u!.email!].join('\n'), style: pw.TextStyle(fontSize: 9, color: _slateGray, lineSpacing: 3)),
              ])),
              pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
                pw.Text('DEVIS', style: pw.TextStyle(fontSize: 28, fontWeight: pw.FontWeight.bold, color: _slateDark)),
                pw.SizedBox(height: 2),
                pw.Text(quote.number, style: pw.TextStyle(fontSize: 11, color: accent, fontWeight: pw.FontWeight.bold)),
                pw.SizedBox(height: 10),
                pw.Text('Émis le ${_fmtDate(quote.issuedAt ?? quote.createdAt)}', style: pw.TextStyle(fontSize: 9, color: _slateGray)),
                pw.SizedBox(height: 2),
                pw.Text("Valable jusqu'au ${_validUntil(quote.issuedAt, quote.validDays)}", style: pw.TextStyle(fontSize: 9, color: _slateGray)),
              ]),
            ]),
            pw.SizedBox(height: 12),
            pw.Container(height: 1, color: _border),
            pw.SizedBox(height: 16),
            pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              pw.Expanded(child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                pw.Text('ADRESSÉ À', style: pw.TextStyle(fontSize: 8, color: accent, letterSpacing: 1.8, fontWeight: pw.FontWeight.bold)),
                pw.SizedBox(height: 5),
                pw.Text(client?.name ?? '—', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold, color: _dark)),
              ])),
              pw.Expanded(child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                pw.Text('OBJET', style: pw.TextStyle(fontSize: 8, color: accent, letterSpacing: 1.8, fontWeight: pw.FontWeight.bold)),
                pw.SizedBox(height: 5),
                pw.Text(quote.title, style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold, color: _dark)),
              ])),
            ]),
            pw.SizedBox(height: 20),
            // Table avec séparateur
            pw.Container(
              decoration: pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(color: _slateDark, width: 1))),
              padding: const pw.EdgeInsets.only(bottom: 6),
              child: pw.Row(children: [
                pw.Expanded(child: pw.Text('Désignation', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: _slateDark, letterSpacing: 1))),
                pw.SizedBox(width: 36, child: pw.Text('Qté', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: _slateDark), textAlign: pw.TextAlign.right)),
                pw.SizedBox(width: 80, child: pw.Text('P.U.', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: _slateDark), textAlign: pw.TextAlign.right)),
                pw.SizedBox(width: 85, child: pw.Text('Total HT', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: _slateDark), textAlign: pw.TextAlign.right)),
              ]),
            ),
            ..._tableRows(quote.items),
            _totals(quote, accent),
            if (quote.notes != null && quote.notes!.isNotEmpty) ...[
              pw.SizedBox(height: 20),
              pw.Container(
                decoration: pw.BoxDecoration(border: pw.Border(left: pw.BorderSide(color: accent, width: 2))),
                padding: const pw.EdgeInsets.only(left: 10),
                child: pw.RichText(text: pw.TextSpan(children: [
                  pw.TextSpan(text: 'Conditions.  ', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: _dark)),
                  pw.TextSpan(text: quote.notes!, style: pw.TextStyle(fontSize: 9, color: _slateMid)),
                ])),
              ),
            ],
            pw.Spacer(),
            pw.Container(height: 1, color: _border),
            pw.SizedBox(height: 6),
            _footer(quote),
          ]),
        ),
      ),
    ]);
  }

  // ─── Effective logo URL ───────────────────────────────────────────────────

  static String? _getEffectiveLogo(Quote quote) {
    final u = quote.user;
    if (u == null) return null;
    if (u.useProfilePhotoAsLogo) return u.logoUrl;
    return u.quoteLogoUrl;
  }

  // ─── Public: generate PDF bytes ──────────────────────────────────────────

  static Future<Uint8List> generate(
    Quote quote,
    String templateId, {
    /// Plan of the logged-in user. FREE plan triggers a "Propulsé par NexaPay"
    /// watermark at the bottom of the page (paid plans get a clean PDF).
    String plan = 'FREE',
  }) async {
    final tmpl = kQuoteTemplates.firstWhere(
      (t) => t.id == templateId,
      orElse: () => kQuoteTemplates.first,
    );

    pw.ImageProvider? logo;
    final logoUrl = _getEffectiveLogo(quote);
    if (logoUrl != null && logoUrl.isNotEmpty) {
      try {
        final response = await Dio().get<List<int>>(logoUrl, options: Options(responseType: ResponseType.bytes));
        if (response.data != null) logo = pw.MemoryImage(Uint8List.fromList(response.data!));
      } catch (_) {}
    }

    final showWatermark = plan == 'FREE';

    final doc = pw.Document();
    doc.addPage(pw.Page(
      pageFormat: PdfPageFormat.a4,
      margin: pw.EdgeInsets.zero,
      build: (_) {
        final body = () {
          switch (tmpl.layout) {
            case QuoteLayoutType.a: return _layoutA(quote, tmpl, logo);
            case QuoteLayoutType.b: return _layoutB(quote, tmpl, logo);
            case QuoteLayoutType.c: return _layoutC(quote, tmpl, logo);
            case QuoteLayoutType.d: return _layoutD(quote, tmpl, logo);
            case QuoteLayoutType.e: return _layoutE(quote, tmpl, logo);
            case QuoteLayoutType.f: return _layoutF(quote, tmpl, logo);
          }
        }();
        if (!showWatermark) return body;
        // Overlay a slim footer ribbon — visible but not intrusive.
        return pw.Stack(children: [
          body,
          pw.Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: _nexaPayFooterRibbon(),
          ),
        ]);
      },
    ));
    return doc.save();
  }

  static pw.Widget _nexaPayFooterRibbon() {
    return pw.Container(
      padding: const pw.EdgeInsets.symmetric(vertical: 6, horizontal: 14),
      decoration: const pw.BoxDecoration(color: PdfColor.fromInt(0xFFE6F4EE)),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.center,
        children: [
          pw.Container(
            width: 10, height: 10,
            decoration: const pw.BoxDecoration(
              color: PdfColor.fromInt(0xFF0F8F65),
              shape: pw.BoxShape.circle,
            ),
          ),
          pw.SizedBox(width: 6),
          pw.Text(
            'Devis généré gratuitement avec NexaPay · nexapay.app',
            style: const pw.TextStyle(
              fontSize: 8.5,
              color: PdfColor.fromInt(0xFF0C7A56),
            ),
          ),
        ],
      ),
    );
  }
}
