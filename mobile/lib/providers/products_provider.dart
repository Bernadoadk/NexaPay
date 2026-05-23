import 'package:flutter/foundation.dart';
import '../models/product.dart';
import '../services/product_service.dart';

class ProductsProvider extends ChangeNotifier {
  List<Product> _products = [];
  bool _loading = false;

  // Search/filter state — kept here so it survives screen rebuilds.
  String _search = '';
  ProductSort _sort = ProductSort.name;
  String _archivedFilter = '0'; // '0' active | '1' archived | 'all'

  List<Product> get products => _products;
  bool get loading => _loading;
  String get search => _search;
  ProductSort get sort => _sort;
  String get archivedFilter => _archivedFilter;

  /// Unique categories observed in the current list (used for chip filters).
  List<String> get knownCategories {
    final set = <String>{};
    for (final p in _products) {
      final c = p.category?.trim() ?? '';
      if (c.isNotEmpty) set.add(c);
    }
    final list = set.toList()..sort();
    return list;
  }

  Future<void> load({bool silent = false}) async {
    if (!silent) {
      _loading = true;
      notifyListeners();
    }
    try {
      _products = await ProductService.list(ProductsListParams(
        search: _search,
        sort: _sort,
        archived: _archivedFilter,
      ));
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> setSearch(String value) async {
    _search = value;
    await load(silent: true);
  }

  Future<void> setSort(ProductSort value) async {
    _sort = value;
    await load(silent: true);
  }

  Future<void> setArchivedFilter(String value) async {
    _archivedFilter = value;
    await load(silent: true);
  }

  Future<Product> create(Map<String, dynamic> data) async {
    final p = await ProductService.create(data);
    _products.insert(0, p);
    notifyListeners();
    return p;
  }

  Future<Product> update(String id, Map<String, dynamic> data) async {
    final p = await ProductService.update(id, data);
    final idx = _products.indexWhere((e) => e.id == id);
    if (idx >= 0) _products[idx] = p;
    notifyListeners();
    return p;
  }

  /// Soft archive — keeps the product in history but hides from picker.
  Future<void> setArchived(String id, bool archived) async {
    final p = await ProductService.archive(id, archived);
    final idx = _products.indexWhere((e) => e.id == id);
    if (idx >= 0) _products[idx] = p;
    notifyListeners();
  }

  Future<Product> duplicate(String id) async {
    final p = await ProductService.duplicate(id);
    _products.insert(0, p);
    notifyListeners();
    return p;
  }

  Future<void> delete(String id) async {
    await ProductService.delete(id);
    _products.removeWhere((p) => p.id == id);
    notifyListeners();
  }
}
