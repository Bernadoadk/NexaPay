import '../models/dashboard_stats.dart';
import 'api_client.dart';

class DashboardService {
  static Future<DashboardStats> getStats() async {
    final res = await ApiClient.instance.get('/dashboard/stats');
    return DashboardStats.fromJson(res.data);
  }
}
