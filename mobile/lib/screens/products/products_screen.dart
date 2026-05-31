import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:dio/dio.dart';
import '../../theme.dart';
import '../../models/product.dart';
import '../../providers/products_provider.dart';
import '../../widgets/confirm_action_sheet.dart';
import '../../widgets/slide_in.dart';

/// Catalogue produits / services — port mobile de la refonte web.
///
/// État serveur (provider) : `search`, `sort`, `archivedFilter`.
/// État local d'écran  : `_categoryFilter` (côté client, depuis `knownCategories`).
///
/// La barre de recherche est debouncée (250 ms) avant de re-frapper `/products`.
class ProductsScreen extends StatefulWidget {
  const ProductsScreen({super.key});

  @override
  State<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends State<ProductsScreen> {
  final _searchCtrl = TextEditingController();
  Timer? _debounce;
  String? _categoryFilter; // null = toutes
  bool _showArchived = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      // Force un reset d'état serveur cohérent avec ce que l'écran affiche
      // par défaut (actifs uniquement, tri par nom).
      final p = context.read<ProductsProvider>();
      _searchCtrl.text = p.search;
      p.load();
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), () {
      if (!mounted) return;
      context.read<ProductsProvider>().setSearch(value.trim());
    });
  }

  Future<void> _toggleArchived(bool show) async {
    setState(() => _showArchived = show);
    await context
        .read<ProductsProvider>()
        .setArchivedFilter(show ? 'all' : '0');
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

  /// Filtre client-side par catégorie sur la liste déjà filtrée serveur.
  List<Product> _applyCategoryFilter(List<Product> source) {
    if (_categoryFilter == null) return source;
    if (_categoryFilter == '_none') {
      return source.where((p) => (p.category ?? '').trim().isEmpty).toList();
    }
    return source
        .where((p) => (p.category ?? '').trim() == _categoryFilter)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.appBg,
      body: SafeArea(
        child: Consumer<ProductsProvider>(
          builder: (ctx, prov, _) {
            final visible = _applyCategoryFilter(prov.products);
            final hasFilters = prov.search.isNotEmpty ||
                _categoryFilter != null ||
                _showArchived;
            return Column(
              children: [
                _Header(onAdd: () => _showForm(context)),
                _SearchAndSort(
                  controller: _searchCtrl,
                  onChanged: _onSearchChanged,
                  sort: prov.sort,
                  onSortChanged: (s) => prov.setSort(s),
                ),
                _CategoryChips(
                  categories: prov.knownCategories,
                  selected: _categoryFilter,
                  onSelect: (c) => setState(() => _categoryFilter = c),
                  showArchived: _showArchived,
                  onToggleArchived: _toggleArchived,
                  showNoneOption:
                      prov.products.any((p) => (p.category ?? '').isEmpty),
                ),
                Expanded(
                  child: prov.loading && prov.products.isEmpty
                      ? const Center(
                          child: CircularProgressIndicator(
                              color: AppColors.primary))
                      : visible.isEmpty
                          ? _EmptyState(
                              hasFilters: hasFilters,
                              search: prov.search,
                              onAdd: () => _showForm(context),
                              onClearFilters: () {
                                _searchCtrl.clear();
                                setState(() {
                                  _categoryFilter = null;
                                  _showArchived = false;
                                });
                                prov.setSearch('');
                                prov.setArchivedFilter('0');
                              },
                            )
                          : RefreshIndicator(
                              color: AppColors.primary,
                              onRefresh: () => prov.load(),
                              child: ListView.builder(
                                padding:
                                    const EdgeInsets.fromLTRB(18, 4, 18, 24),
                                itemCount: visible.length,
                                itemBuilder: (_, i) => SlideIn(
                                  delay: Duration(milliseconds: 40 * i),
                                  child: _ProductCard(
                                    product: visible[i],
                                    fmtXOF: _fmtXOF,
                                    onEdit: () => _showForm(context,
                                        product: visible[i]),
                                    onDuplicate: () =>
                                        _duplicate(context, prov, visible[i]),
                                    onArchive: () =>
                                        _archive(context, prov, visible[i]),
                                    onDelete: () =>
                                        _confirmDelete(context, prov, visible[i]),
                                  ),
                                ),
                              ),
                            ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Future<void> _duplicate(
      BuildContext ctx, ProductsProvider prov, Product p) async {
    try {
      await prov.duplicate(p.id);
      if (!ctx.mounted) return;
      ScaffoldMessenger.of(ctx).showSnackBar(
        SnackBar(
          content: Text('« ${p.name} » dupliqué'),
          backgroundColor: AppColors.primary,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (_) {
      if (!ctx.mounted) return;
      ScaffoldMessenger.of(ctx).showSnackBar(
        const SnackBar(
          content: Text('Erreur lors de la duplication'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _archive(
      BuildContext ctx, ProductsProvider prov, Product p) async {
    final next = !p.archived;
    try {
      await prov.setArchived(p.id, next);
      if (!ctx.mounted) return;
      ScaffoldMessenger.of(ctx).showSnackBar(
        SnackBar(
          content: Text(next
              ? '« ${p.name} » archivé'
              : '« ${p.name} » restauré'),
          backgroundColor: AppColors.primary,
          behavior: SnackBarBehavior.floating,
          action: SnackBarAction(
            label: 'Annuler',
            textColor: Colors.white,
            onPressed: () => prov.setArchived(p.id, !next),
          ),
        ),
      );
    } catch (_) {
      if (!ctx.mounted) return;
      ScaffoldMessenger.of(ctx).showSnackBar(
        const SnackBar(content: Text('Erreur lors de l\'archivage')),
      );
    }
  }

  Future<void> _confirmDelete(
      BuildContext ctx, ProductsProvider prov, Product p) async {
    final confirmed = await showConfirmActionSheet(
      context: ctx,
      title: 'Supprimer « ${p.name} » ?',
      message:
          'Cet article sera supprimé définitivement du catalogue. Cette action est irréversible.',
      confirmLabel: 'Supprimer',
      tone: ConfirmActionTone.danger,
    );
    if (!confirmed || !ctx.mounted) return;

    try {
      await prov.delete(p.id);
    } on DioException catch (e) {
      // Le backend renvoie 409/IN_USE si le produit est référencé
      // par un devis existant — on bascule alors sur archive.
      if (!ctx.mounted) return;
      if (e.response?.statusCode == 409) {
        _offerArchiveInstead(ctx, prov, p);
      } else {
        ScaffoldMessenger.of(ctx).showSnackBar(
          const SnackBar(content: Text('Erreur lors de la suppression')),
        );
      }
    }
  }

  Future<void> _offerArchiveInstead(
      BuildContext ctx, ProductsProvider prov, Product p) async {
    final confirmed = await showConfirmActionSheet(
      context: ctx,
      title: 'Produit déjà utilisé',
      message:
          '« ${p.name} » apparaît dans des devis existants et ne peut pas être supprimé. Vous pouvez l’archiver pour le masquer du catalogue actif.',
      confirmLabel: 'Archiver',
      tone: ConfirmActionTone.warning,
      icon: Icons.archive_outlined,
    );
    if (confirmed && ctx.mounted) await _archive(ctx, prov, p);
  }

  void _showForm(BuildContext ctx, {Product? product}) {
    showModalBottomSheet(
      context: ctx,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (_) => _ProductFormSheet(product: product),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

class _Header extends StatelessWidget {
  final VoidCallback onAdd;
  const _Header({required this.onAdd});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 14, 18, 0),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
            onPressed: () => Navigator.pop(context),
          ),
          const Expanded(
            child: Text(
              'Catalogue',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                letterSpacing: -0.5,
              ),
            ),
          ),
          ElevatedButton.icon(
            onPressed: onAdd,
            icon: const Icon(Icons.add_rounded, size: 16),
            label: const Text('Ajouter'),
            style: ElevatedButton.styleFrom(
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              minimumSize: Size.zero,
              textStyle: const TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Search + sort
// ─────────────────────────────────────────────────────────────────────────────

class _SearchAndSort extends StatelessWidget {
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final ProductSort sort;
  final ValueChanged<ProductSort> onSortChanged;

  const _SearchAndSort({
    required this.controller,
    required this.onChanged,
    required this.sort,
    required this.onSortChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 10, 18, 8),
      child: Row(
        children: [
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: context.appSurface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: context.appBorder),
              ),
              child: TextField(
                controller: controller,
                onChanged: onChanged,
                decoration: InputDecoration(
                  hintText: 'Rechercher (nom, description, catégorie)…',
                  hintStyle: TextStyle(
                      fontSize: 13, color: context.appTextSubtle),
                  prefixIcon: Icon(Icons.search_rounded,
                      size: 18, color: context.appTextMuted),
                  suffixIcon: controller.text.isEmpty
                      ? null
                      : IconButton(
                          icon: Icon(Icons.close_rounded,
                              size: 16, color: context.appTextMuted),
                          onPressed: () {
                            controller.clear();
                            onChanged('');
                          },
                        ),
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  isDense: true,
                  contentPadding:
                      const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Container(
            decoration: BoxDecoration(
              color: context.appSurface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: context.appBorder),
            ),
            child: PopupMenuButton<ProductSort>(
              tooltip: 'Trier',
              icon: Icon(Icons.swap_vert_rounded,
                  size: 20, color: context.appTextMuted),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
              onSelected: onSortChanged,
              itemBuilder: (_) => ProductSort.values
                  .map(
                    (s) => PopupMenuItem(
                      value: s,
                      child: Row(
                        children: [
                          Icon(
                            sort == s
                                ? Icons.radio_button_checked_rounded
                                : Icons.radio_button_off_rounded,
                            size: 16,
                            color: sort == s
                                ? AppColors.primary
                                : context.appTextSubtle,
                          ),
                          const SizedBox(width: 10),
                          Text(s.label,
                              style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: sort == s
                                      ? FontWeight.w600
                                      : FontWeight.w400)),
                        ],
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Category chips + archived toggle
// ─────────────────────────────────────────────────────────────────────────────

class _CategoryChips extends StatelessWidget {
  final List<String> categories;
  final String? selected;
  final ValueChanged<String?> onSelect;
  final bool showArchived;
  final ValueChanged<bool> onToggleArchived;
  final bool showNoneOption;

  const _CategoryChips({
    required this.categories,
    required this.selected,
    required this.onSelect,
    required this.showArchived,
    required this.onToggleArchived,
    required this.showNoneOption,
  });

  @override
  Widget build(BuildContext context) {
    // On évite d'afficher la rangée si rien à filtrer pour ne pas voler
    // de la verticalité à la liste.
    if (categories.isEmpty && !showNoneOption) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(18, 0, 18, 8),
        child: Row(
          children: [
            const Spacer(),
            _ArchivedToggle(
                value: showArchived, onChanged: onToggleArchived),
          ],
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 0, 0, 8),
      child: SizedBox(
        height: 36,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 18),
          children: [
            _Chip(
              label: 'Toutes',
              selected: selected == null,
              onTap: () => onSelect(null),
            ),
            for (final c in categories)
              _Chip(
                label: c,
                selected: selected == c,
                onTap: () => onSelect(selected == c ? null : c),
              ),
            if (showNoneOption)
              _Chip(
                label: 'Sans catégorie',
                selected: selected == '_none',
                onTap: () => onSelect(selected == '_none' ? null : '_none'),
              ),
            const SizedBox(width: 8),
            Center(
              child: _ArchivedToggle(
                  value: showArchived, onChanged: onToggleArchived),
            ),
          ],
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _Chip(
      {required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            color: selected ? AppColors.primary : context.appSurface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: selected ? AppColors.primary : context.appBorder,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: selected ? Colors.white : context.appText,
            ),
          ),
        ),
      ),
    );
  }
}

class _ArchivedToggle extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;

  const _ArchivedToggle({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => onChanged(!value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: value
              ? const Color(0xFFFEF3C7)
              : context.appSurface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color:
                value ? const Color(0xFFFCD34D) : context.appBorder,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              value
                  ? Icons.inventory_rounded
                  : Icons.inventory_2_outlined,
              size: 13,
              color: value
                  ? const Color(0xFF92400E)
                  : context.appTextMuted,
            ),
            const SizedBox(width: 5),
            Text(
              value ? 'Archivés inclus' : 'Afficher archivés',
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                color: value
                    ? const Color(0xFF92400E)
                    : context.appTextMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Product card
// ─────────────────────────────────────────────────────────────────────────────

class _ProductCard extends StatelessWidget {
  final Product product;
  final String Function(double) fmtXOF;
  final VoidCallback onEdit;
  final VoidCallback onDuplicate;
  final VoidCallback onArchive;
  final VoidCallback onDelete;

  const _ProductCard({
    required this.product,
    required this.fmtXOF,
    required this.onEdit,
    required this.onDuplicate,
    required this.onArchive,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final archived = product.archived;
    return Opacity(
      opacity: archived ? 0.65 : 1,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: context.appSurface,
          borderRadius: BorderRadius.circular(13),
          border: Border.all(
            color: archived
                ? const Color(0xFFFCD34D).withOpacity(0.5)
                : context.appBorder,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: archived
                    ? const Color(0xFFFEF3C7)
                    : AppColors.primarySoft,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                archived
                    ? Icons.inventory_rounded
                    : Icons.inventory_2_outlined,
                size: 20,
                color: archived
                    ? const Color(0xFF92400E)
                    : AppColors.primary,
              ),
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
                          style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600),
                        ),
                      ),
                      if (archived) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF3C7),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text('ARCHIVÉ',
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF92400E),
                                letterSpacing: 0.5,
                              )),
                        ),
                      ],
                    ],
                  ),
                  if (product.category != null &&
                      product.category!.trim().isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      product.category!,
                      style: TextStyle(
                          fontSize: 11,
                          color: AppColors.primary,
                          fontWeight: FontWeight.w600),
                    ),
                  ],
                  if (product.description != null &&
                      product.description!.trim().isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      product.description!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontSize: 12, color: context.appTextMuted),
                    ),
                  ],
                  const SizedBox(height: 6),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Text(
                        fmtXOF(product.price),
                        style: const TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                      ),
                      if (product.unit != null) ...[
                        Text(' / ',
                            style: TextStyle(
                                color: context.appTextMuted, fontSize: 12)),
                        Text(product.unit!,
                            style: TextStyle(
                                fontSize: 12, color: context.appTextMuted)),
                      ],
                      if (product.usageCount > 0) ...[
                        const SizedBox(width: 10),
                        Container(
                          width: 3,
                          height: 3,
                          decoration: BoxDecoration(
                            color: context.appTextSubtle,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Icon(Icons.repeat_rounded,
                            size: 11, color: context.appTextMuted),
                        const SizedBox(width: 3),
                        Text(
                          '${product.usageCount}×',
                          style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w600,
                              color: context.appTextMuted),
                        ),
                        if (product.totalBilled > 0) ...[
                          Text(
                            ' · ${fmtXOF(product.totalBilled)}',
                            style: TextStyle(
                                fontSize: 11,
                                color: context.appTextSubtle),
                          ),
                        ],
                      ],
                    ],
                  ),
                ],
              ),
            ),
            PopupMenuButton<String>(
              icon: Icon(Icons.more_vert_rounded,
                  color: context.appTextMuted, size: 20),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
              onSelected: (v) {
                switch (v) {
                  case 'edit':
                    onEdit();
                    break;
                  case 'duplicate':
                    onDuplicate();
                    break;
                  case 'archive':
                    onArchive();
                    break;
                  case 'delete':
                    onDelete();
                    break;
                }
              },
              itemBuilder: (_) => [
                const PopupMenuItem(
                  value: 'edit',
                  child: Row(children: [
                    Icon(Icons.edit_outlined, size: 16),
                    SizedBox(width: 10),
                    Text('Modifier'),
                  ]),
                ),
                const PopupMenuItem(
                  value: 'duplicate',
                  child: Row(children: [
                    Icon(Icons.content_copy_rounded, size: 16),
                    SizedBox(width: 10),
                    Text('Dupliquer'),
                  ]),
                ),
                PopupMenuItem(
                  value: 'archive',
                  child: Row(children: [
                    Icon(
                        archived
                            ? Icons.unarchive_outlined
                            : Icons.archive_outlined,
                        size: 16),
                    const SizedBox(width: 10),
                    Text(archived ? 'Restaurer' : 'Archiver'),
                  ]),
                ),
                const PopupMenuDivider(),
                const PopupMenuItem(
                  value: 'delete',
                  child: Row(children: [
                    Icon(Icons.delete_outline_rounded,
                        size: 16, color: AppColors.statusOverdue),
                    SizedBox(width: 10),
                    Text('Supprimer',
                        style: TextStyle(color: AppColors.statusOverdue)),
                  ]),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty states (catalogue vide vs filtres sans résultat)
// ─────────────────────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  final bool hasFilters;
  final String search;
  final VoidCallback onAdd;
  final VoidCallback onClearFilters;

  const _EmptyState({
    required this.hasFilters,
    required this.search,
    required this.onAdd,
    required this.onClearFilters,
  });

  @override
  Widget build(BuildContext context) {
    if (hasFilters) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.search_off_rounded,
                  size: 40, color: context.appTextMuted),
              const SizedBox(height: 12),
              Text(
                search.isNotEmpty
                    ? 'Aucun résultat pour « $search »'
                    : 'Aucun produit ne correspond aux filtres',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: context.appText),
              ),
              const SizedBox(height: 14),
              OutlinedButton.icon(
                onPressed: onClearFilters,
                icon: const Icon(Icons.close_rounded, size: 14),
                label: const Text('Réinitialiser'),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: context.appBorder),
                  foregroundColor: context.appText,
                ),
              ),
            ],
          ),
        ),
      );
    }
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Icon(Icons.inventory_2_outlined,
                size: 36, color: AppColors.primary),
          ),
          const SizedBox(height: 16),
          Text('Aucun produit / service',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: context.appText)),
          const SizedBox(height: 6),
          Text(
            'Ajoutez vos prestations pour les\ninsérer rapidement dans vos devis.',
            textAlign: TextAlign.center,
            style: TextStyle(
                fontSize: 13.5,
                color: context.appTextMuted,
                height: 1.5),
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: onAdd,
            icon: const Icon(Icons.add_rounded, size: 16),
            label: const Text('Ajouter un produit'),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Form sheet — nom · description · catégorie (autocomplete) ·
// prix · unité (chips de suggestions) + prévisualisation
// ─────────────────────────────────────────────────────────────────────────────

const List<String> _kUnitSuggestions = [
  'unité',
  'heure',
  'jour',
  'mois',
  'forfait',
  'm²',
  'kg',
  'ml',
];

class _ProductFormSheet extends StatefulWidget {
  final Product? product;
  const _ProductFormSheet({this.product});

  @override
  State<_ProductFormSheet> createState() => _ProductFormSheetState();
}

class _ProductFormSheetState extends State<_ProductFormSheet> {
  late final TextEditingController _name;
  late final TextEditingController _desc;
  late final TextEditingController _category;
  late final TextEditingController _price;
  late final TextEditingController _unit;
  bool _loading = false;

  bool get _isEdit => widget.product != null;

  @override
  void initState() {
    super.initState();
    final p = widget.product;
    _name = TextEditingController(text: p?.name ?? '');
    _desc = TextEditingController(text: p?.description ?? '');
    _category = TextEditingController(text: p?.category ?? '');
    _price =
        TextEditingController(text: p != null ? p.price.toStringAsFixed(0) : '');
    _unit = TextEditingController(text: p?.unit ?? '');
  }

  @override
  void dispose() {
    _name.dispose();
    _desc.dispose();
    _category.dispose();
    _price.dispose();
    _unit.dispose();
    super.dispose();
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

  Future<void> _save() async {
    if (_name.text.trim().isEmpty || _price.text.trim().isEmpty) return;
    setState(() => _loading = true);
    final prov = context.read<ProductsProvider>();
    try {
      final raw = _price.text.replaceAll(' ', '').replaceAll(',', '.');
      final data = <String, dynamic>{
        'name': _name.text.trim(),
        'price': double.tryParse(raw) ?? 0,
        if (_desc.text.trim().isNotEmpty) 'description': _desc.text.trim(),
        if (_category.text.trim().isNotEmpty)
          'category': _category.text.trim(),
        if (_unit.text.trim().isNotEmpty) 'unit': _unit.text.trim(),
      };
      if (_isEdit) {
        await prov.update(widget.product!.id, data);
      } else {
        await prov.create(data);
      }
      if (mounted) Navigator.pop(context);
    } catch (_) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Erreur lors de l\'enregistrement')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<ProductsProvider>();
    final knownCategories = prov.knownCategories;
    final priceNum = double.tryParse(
            _price.text.replaceAll(' ', '').replaceAll(',', '.')) ??
        0;

    return Padding(
      padding: EdgeInsets.fromLTRB(
          22, 14, 22, MediaQuery.of(context).viewInsets.bottom + 22),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: context.appBorder,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              _isEdit ? 'Modifier le produit' : 'Nouveau produit',
              style: const TextStyle(
                  fontSize: 17, fontWeight: FontWeight.w700, letterSpacing: -0.3),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _name,
              autofocus: !_isEdit,
              decoration: const InputDecoration(labelText: 'Nom *'),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _desc,
              maxLines: 2,
              decoration:
                  const InputDecoration(labelText: 'Description (optionnel)'),
            ),
            const SizedBox(height: 8),
            // Category with autocomplete from known categories.
            Autocomplete<String>(
              initialValue: TextEditingValue(text: _category.text),
              optionsBuilder: (textEditingValue) {
                final q = textEditingValue.text.trim().toLowerCase();
                if (q.isEmpty) return knownCategories;
                return knownCategories
                    .where((c) => c.toLowerCase().contains(q));
              },
              onSelected: (v) {
                _category.text = v;
                setState(() {});
              },
              fieldViewBuilder: (ctx, ctrl, focusNode, onSubmit) {
                // Garde la synchro avec notre contrôleur source pour la sauvegarde
                ctrl.text = _category.text;
                ctrl.addListener(() {
                  if (_category.text != ctrl.text) {
                    _category.text = ctrl.text;
                  }
                });
                return TextField(
                  controller: ctrl,
                  focusNode: focusNode,
                  decoration: const InputDecoration(
                      labelText: 'Catégorie (optionnel)'),
                );
              },
              optionsViewBuilder: (ctx, onSelected, options) {
                return Align(
                  alignment: Alignment.topLeft,
                  child: Material(
                    elevation: 4,
                    borderRadius: BorderRadius.circular(10),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxHeight: 180),
                      child: ListView(
                        padding: EdgeInsets.zero,
                        shrinkWrap: true,
                        children: options
                            .map((o) => InkWell(
                                  onTap: () => onSelected(o),
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 14, vertical: 10),
                                    child: Text(o,
                                        style:
                                            const TextStyle(fontSize: 13)),
                                  ),
                                ))
                            .toList(),
                      ),
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  flex: 2,
                  child: TextField(
                    controller: _price,
                    keyboardType: const TextInputType.numberWithOptions(
                        decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[0-9 ,.]')),
                    ],
                    decoration:
                        const InputDecoration(labelText: 'Prix (F CFA) *'),
                    onChanged: (_) => setState(() {}),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _unit,
                    decoration: const InputDecoration(labelText: 'Unité'),
                    onChanged: (_) => setState(() {}),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            // Suggestions d'unités — un tap remplace le champ.
            Wrap(
              spacing: 6,
              runSpacing: -2,
              children: _kUnitSuggestions.map((u) {
                final active = _unit.text.trim() == u;
                return GestureDetector(
                  onTap: () => setState(() => _unit.text = u),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: active
                          ? AppColors.primarySoft
                          : context.appBg,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: active
                            ? AppColors.primary.withOpacity(0.4)
                            : context.appBorder,
                      ),
                    ),
                    child: Text(
                      u,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight:
                            active ? FontWeight.w700 : FontWeight.w500,
                        color: active
                            ? AppColors.primary
                            : context.appTextMuted,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 14),
            // Prévisualisation du prix tel qu'il apparaîtra dans le devis.
            if (priceNum > 0)
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(12),
                  border:
                      Border.all(color: AppColors.primary.withOpacity(0.18)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.visibility_outlined,
                        size: 16, color: AppColors.primary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Aperçu',
                            style: TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.6,
                              color: AppColors.primary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _fmtXOF(priceNum) +
                                (_unit.text.trim().isNotEmpty
                                    ? ' / ${_unit.text.trim()}'
                                    : ''),
                            style: const TextStyle(
                              fontSize: 15,
                              fontFamily: 'monospace',
                              fontWeight: FontWeight.w800,
                              color: AppColors.primaryDark,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 18),
            ElevatedButton(
              onPressed: _loading ? null : _save,
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: _loading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2))
                  : Text(_isEdit ? 'Enregistrer' : 'Créer'),
            ),
          ],
        ),
      ),
    );
  }
}
