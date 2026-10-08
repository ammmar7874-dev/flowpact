import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;

class ApiConfig {
  ApiConfig._();

  // Environment variables passed via --dart-define
  static const String _envApiBaseUrl = String.fromEnvironment('API_BASE_URL');
  static const String _envAppUrl = String.fromEnvironment('APP_URL');

  static String _customBaseUrl = '';

  /// Allows runtime override for testing or custom host configuration
  static void setBaseUrl(String url) {
    _customBaseUrl = url.trim();
  }

  /// Base URL for backend REST API calls:
  /// 1. Custom runtime override (setBaseUrl)
  /// 2. --dart-define=API_BASE_URL=...
  /// 3. Platform default (Android Emulator: http://10.0.2.2:3000, Web/Desktop/Tests: http://localhost:3000)
  static String get baseUrl {
    if (_customBaseUrl.isNotEmpty) return _customBaseUrl;
    if (_envApiBaseUrl.isNotEmpty) return _envApiBaseUrl.replaceAll(RegExp(r'/+$'), '');
    if (kIsWeb) return 'http://localhost:3000';
    try {
      if (Platform.isAndroid) {
        return 'http://10.0.2.2:3000';
      }
    } catch (_) {}
    return 'http://localhost:3000';
  }

  /// Base URL for web checkout & public verification pages:
  /// 1. --dart-define=APP_URL=...
  /// 2. Falls back to baseUrl
  static String get webBaseUrl {
    if (_envAppUrl.isNotEmpty) return _envAppUrl.replaceAll(RegExp(r'/+$'), '');
    return baseUrl;
  }

  // Server API endpoints
  static String get contractsUrl => '$baseUrl/api/contracts';
  static String get createContractUrl => '$baseUrl/api/contracts/create';
  static String contractDetailUrl(String contractId) => '$baseUrl/api/contracts/$contractId';

  // Web Checkout & Cryptographic Receipt URLs
  static String paymentCheckoutUrl(String contractId) => '$webBaseUrl/pay/$contractId';
  static String verifiedReceiptUrl(String txSignature) => '$webBaseUrl/verify/$txSignature';
}
