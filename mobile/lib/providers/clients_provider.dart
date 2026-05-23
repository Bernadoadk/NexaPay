import 'package:flutter/material.dart';
import '../models/client.dart';
import '../services/client_service.dart';

class ClientsProvider extends ChangeNotifier {
  List<Client> _clients = [];
  bool _loading = false;

  List<Client> get clients => _clients;
  bool get loading => _loading;

  Future<void> loadClients({String? search}) async {
    _loading = true;
    notifyListeners();
    try {
      _clients = await ClientService.getAll(search: search);
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<Client> createClient({
    required String name,
    String? contact,
    String? email,
    String? phone,
    String? phoneCountry,
    String? city,
  }) async {
    final client = await ClientService.create(
      name: name,
      contact: contact,
      email: email,
      phone: phone,
      phoneCountry: phoneCountry,
      city: city,
    );
    _clients.insert(0, client);
    notifyListeners();
    return client;
  }
}
