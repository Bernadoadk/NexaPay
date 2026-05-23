import '../models/client.dart';
import 'api_client.dart';

class ClientService {
  static Future<List<Client>> getAll({String? search}) async {
    final res = await ApiClient.instance.get('/clients', queryParameters: {
      if (search != null && search.isNotEmpty) 'search': search,
    });
    return (res.data as List).map((e) => Client.fromJson(e)).toList();
  }

  static Future<Client> create({
    required String name,
    String? contact,
    String? email,
    String? phone,
    String? phoneCountry,
    String? city,
    String? address,
    String? ifu,
  }) async {
    final res = await ApiClient.instance.post('/clients', data: {
      'name': name,
      if (contact != null) 'contact': contact,
      if (email != null) 'email': email,
      if (phone != null) 'phone': phone,
      if (phoneCountry != null) 'phoneCountry': phoneCountry,
      if (city != null) 'city': city,
      if (address != null) 'address': address,
      if (ifu != null) 'ifu': ifu,
    });
    return Client.fromJson(res.data);
  }
}
