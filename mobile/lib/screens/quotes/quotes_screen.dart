import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../theme.dart';
import '../../models/quote.dart';
import '../../providers/quotes_provider.dart';
import '../../utils/nav.dart';
import '../../widgets/avatar_widget.dart';
import '../../widgets/status_badge.dart';
import 'quote_detail_screen.dart';

class QuotesScreen extends StatefulWidget {
  const QuotesScreen({super.key});

  @override
  State<QuotesScreen> createState() => _QuotesScreenState();
}

class _QuotesScreenState extends State<QuotesScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  final _tabs = ['Tous', 'Envoyé', 'Brouillon', 'Payé', 'En retard'];

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: _tabs.length, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback(
        (_) => context.read<QuotesProvider>().loadQuotes());
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  List<Quote> _filtered(List<Quote> all, int tab) {
    if (tab == 0) return all;
    final statuses = [
      null,
      QuoteStatus.sent,
      QuoteStatus.draft,
      QuoteStatus.paid,
      QuoteStatus.overdue
    ];
    return all.where((q) => q.status == statuses[tab]).toList();
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.appBg,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
              child: Row(
                children: [
                  const Expanded(
                      child: Text('Devis',
                          style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                              letterSpacing: -0.5))),
                  IconButton(
                      icon: Icon(Icons.search_rounded,
                          color: context.appText),
                      onPressed: () {}),
                ],
              ),
            ),
            TabBar(
              controller: _tabCtrl,
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              labelColor: AppColors.primary,
              unselectedLabelColor: context.appTextMuted,
              labelStyle: TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w600),
              unselectedLabelStyle: TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w500),
              indicatorColor: AppColors.primary,
              indicatorSize: TabBarIndicatorSize.label,
              dividerColor: context.appBorder,
              tabs: _tabs.map((t) => Tab(text: t)).toList(),
            ),
            Expanded(
              child: Consumer<QuotesProvider>(
                builder: (ctx, prov, _) {
                  if (prov.loading) {
                    return const Center(
                        child: CircularProgressIndicator(
                            color: AppColors.primary));
                  }
                  return TabBarView(
                    controller: _tabCtrl,
                    children: List.generate(_tabs.length, (i) {
                      final list = _filtered(prov.quotes, i);
                      if (list.isEmpty) {
                        return Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.description_outlined,
                                  size: 48,
                                  color: context.appTextSubtle),
                              const SizedBox(height: 12),
                              Text('Aucun devis',
                                  style: TextStyle(
                                      color: context.appTextMuted,
                                      fontSize: 15)),
                            ],
                          ),
                        );
                      }
                      return RefreshIndicator(
                        color: AppColors.primary,
                        onRefresh: () => prov.loadQuotes(),
                        child: ListView.separated(
                          padding:
                              const EdgeInsets.fromLTRB(18, 12, 18, 24),
                          itemCount: list.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
                          itemBuilder: (ctx, j) =>
                              _buildItem(list[j]),
                        ),
                      );
                    }),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildItem(Quote quote) {
    final client = quote.client;
    return GestureDetector(
      onTap: () => Navigator.push(
          context, fadeSlideRoute(QuoteDetailScreen(quoteId: quote.id))),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: context.appSurface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: context.appBorder),
        ),
        child: Row(
          children: [
            AvatarWidget(
                name: client?.name ?? '?',
                color: client?.color ?? '#0F8F65',
                size: 40),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(quote.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontSize: 13.5, fontWeight: FontWeight.w500)),
                  const SizedBox(height: 2),
                  Text('${client?.name ?? ''} · ${quote.number}',
                      style: TextStyle(
                          fontSize: 11.5, color: context.appTextMuted)),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(_fmtXOF(quote.total),
                    style: TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                StatusBadge(status: quote.status),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
