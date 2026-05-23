import 'package:flutter/material.dart';
import '../models/quote.dart';
import '../services/quote_service.dart';

class QuotesProvider extends ChangeNotifier {
  List<Quote> _quotes = [];
  bool _loading = false;
  String? _error;

  List<Quote> get quotes => _quotes;
  bool get loading => _loading;
  String? get error => _error;

  Future<void> loadQuotes({String? status}) async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      _quotes = await QuoteService.getAll(status: status);
    } catch (e) {
      _error = e.toString();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<Quote> createQuote({
    required String title,
    required String clientId,
    required List<QuoteItem> items,
    String? notes,
    double taxRate = 18,
    int validDays = 30,
  }) async {
    final quote = await QuoteService.create(
      title: title,
      clientId: clientId,
      items: items,
      notes: notes,
      taxRate: taxRate,
      validDays: validDays,
    );
    _quotes.insert(0, quote);
    notifyListeners();
    return quote;
  }

  Future<void> updateStatus(String id, String status) async {
    final updated = await QuoteService.updateStatus(id, status);
    final idx = _quotes.indexWhere((q) => q.id == id);
    if (idx != -1) {
      _quotes[idx] = updated;
      notifyListeners();
    }
  }

  Future<void> deleteQuote(String id) async {
    await QuoteService.delete(id);
    _quotes.removeWhere((q) => q.id == id);
    notifyListeners();
  }
}
