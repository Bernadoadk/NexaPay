import '../models/product.dart';
import 'api_client.dart';

class ProductsListParams {
  final String? search;
  final ProductSort sort;
  /// '0' = active only · '1' = archived only · 'all' = both.
  final String archived;

  const ProductsListParams({
    this.search,
    this.sort = ProductSort.name,
    this.archived = '0',
  });

  Map<String, dynamic> toQuery() => {
        if (search != null && search!.isNotEmpty) 'search': search,
        'sort': sort.apiValue,
        'archived': archived,
      };
}

class ProductService {
  /// List products with server-side search/sort/archive filters.
  /// Returns items already enriched with `usageCount` and `totalBilled`.
  static Future<List<Product>> list(
      [ProductsListParams params = const ProductsListParams()]) async {
    final res = await ApiClient.instance
        .get('/products', queryParameters: params.toQuery());
    return (res.data as List).map((e) => Product.fromJson(e)).toList();
  }

  /// Backwards-compatible alias used by older screens.
  static Future<List<Product>> getAll() => list();

  static Future<Product> create(Map<String, dynamic> data) async {
    final res = await ApiClient.instance.post('/products', data: data);
    return Product.fromJson(res.data);
  }

  static Future<Product> update(String id, Map<String, dynamic> data) async {
    final res = await ApiClient.instance.put('/products/$id', data: data);
    return Product.fromJson(res.data);
  }

  /// Hard delete — backend refuses with `IN_USE` (409) if the product is used
  /// in any past quote; UI should then offer archive instead.
  static Future<void> delete(String id) async {
    await ApiClient.instance.delete('/products/$id');
  }

  static Future<Product> archive(String id, bool archived) async {
    final res = await ApiClient.instance
        .patch('/products/$id/archive', data: {'archived': archived});
    return Product.fromJson(res.data);
  }

  static Future<Product> duplicate(String id) async {
    final res = await ApiClient.instance.post('/products/$id/duplicate');
    return Product.fromJson(res.data);
  }

  static Future<List<String>> categories() async {
    final res = await ApiClient.instance.get('/products/categories');
    return (res.data as List<dynamic>).map((e) => e.toString()).toList();
  }
}
