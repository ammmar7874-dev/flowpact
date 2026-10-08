import 'dart:convert';
import 'dart:io' show Platform;
import 'package:http/http.dart' as http;
import '../../core/constants/api_config.dart';
import '../models/contract_model.dart';
import 'api_service.dart';

class HttpApiService implements ApiService {
  final http.Client _client;
  String? _workingBaseUrl;

  HttpApiService({http.Client? client}) : _client = client ?? http.Client();

  Future<String> _getBaseUrl() async {
    if (_workingBaseUrl != null) return _workingBaseUrl!;

    final primary = ApiConfig.baseUrl;

    // 1. Fast probe configured baseUrl (e.g. http://10.0.2.2:3000 on Android)
    try {
      final res = await _client.get(
        Uri.parse('$primary/api/contracts'),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(milliseconds: 1200));

      if (res.statusCode == 200) {
        _workingBaseUrl = primary;
        return primary;
      }
    } catch (_) {}

    // 2. On Android, if 10.0.2.2 is not routed (e.g. LDPlayer or physical device with adb reverse),
    // fallback to reverse forwarded loopback 127.0.0.1:3000 or host LAN IP
    if (Platform.isAndroid) {
      final fallbacks = [
        'http://127.0.0.1:3000',
        'http://192.168.18.157:3000',
      ];
      for (final fb in fallbacks) {
        try {
          final res = await _client.get(
            Uri.parse('$fb/api/contracts'),
            headers: {'Accept': 'application/json'},
          ).timeout(const Duration(milliseconds: 1200));

          if (res.statusCode == 200) {
            _workingBaseUrl = fb;
            return fb;
          }
        } catch (_) {}
      }
    }

    _workingBaseUrl = primary;
    return primary;
  }

  @override
  Future<List<ContractModel>> getContracts() async {
    try {
      final baseUrl = await _getBaseUrl();
      final uri = Uri.parse('$baseUrl/api/contracts');
      final response = await _client.get(
        uri,
        headers: {
          'Accept': 'application/json',
        },
      ).timeout(const Duration(seconds: 12));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        if (data['success'] == true && data['contracts'] is List) {
          final list = data['contracts'] as List;
          return list
              .map((item) => ContractModel.fromJson(item as Map<String, dynamic>))
              .toList();
        }
        throw Exception(data['error'] ?? 'Malformed response from contracts API');
      } else {
        throw Exception('Server returned ${response.statusCode}: ${response.body}');
      }
    } catch (e) {
      throw Exception('Failed to connect to FlowPact server: $e');
    }
  }

  @override
  Future<ContractModel> getContractById(String contractId) async {
    try {
      final baseUrl = await _getBaseUrl();
      final uri = Uri.parse('$baseUrl/api/contracts/$contractId');
      final response = await _client.get(
        uri,
        headers: {
          'Accept': 'application/json',
        },
      ).timeout(const Duration(seconds: 12));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        if (data['success'] == true && data['contract'] is Map<String, dynamic>) {
          return ContractModel.fromJson(data['contract'] as Map<String, dynamic>);
        }
        throw Exception(data['error'] ?? 'Contract not found in response');
      } else {
        throw Exception('Failed to retrieve contract (HTTP ${response.statusCode})');
      }
    } catch (e) {
      throw Exception('Failed to fetch contract details: $e');
    }
  }

  @override
  Future<ContractModel> createContract({
    required String projectTitle,
    required String scopeDescription,
    required String clientName,
    required double amount,
    required String freelancerWallet,
  }) async {
    try {
      final baseUrl = await _getBaseUrl();
      final uri = Uri.parse('$baseUrl/api/contracts/create');
      final response = await _client.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({
          'projectTitle': projectTitle,
          'scopeDescription': scopeDescription,
          'clientName': clientName,
          'amount': amount,
          'freelancerWallet': freelancerWallet,
        }),
      ).timeout(const Duration(seconds: 15));

      final data = jsonDecode(response.body) as Map<String, dynamic>;

      if (response.statusCode == 200 || response.statusCode == 201) {
        if (data['success'] == true && data['contract'] is Map<String, dynamic>) {
          return ContractModel.fromJson(data['contract'] as Map<String, dynamic>);
        }
        throw Exception(data['error'] ?? 'Failed to parse created contract');
      } else {
        throw Exception(data['error'] ?? 'Server error ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Contract creation failed: $e');
    }
  }
}
