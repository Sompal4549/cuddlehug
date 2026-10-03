import 'package:cuddlehug_app/app_providers.dart';
import 'package:cuddlehug_app/core/network/api_endpoints.dart';
import 'package:cuddlehug_app/core/network/dio_client.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Flat public settings from `GET /api/settings` (dotted keys, typed
/// values — same shape the web app consumes).
@immutable
class StoreSettings {
  const new(this.raw);

  final Map<String, dynamic> raw;

  bool get razorpayEnabled => raw['payment.razorpayEnabled'] == true;
  bool get codEnabled => raw['shipping.codEnabled'] as bool? ?? true;
  bool get storeOpen => raw['store.status'] != 'closed';
  String get storeName => raw['store.name'] as String? ?? 'CuddleHug';
  String get storeTagline =>
      raw['store.tagline'] as String? ?? 'More Happiness. More Hugs.';
  String get contactEmail =>
      raw['contact.email'] as String? ?? 'hello@cuddlehug.com';
  String get contactPhone =>
      raw['contact.phone'] as String? ?? '+91 98765 43210';
  String get contactAddress => raw['contact.address'] as String? ?? '';
  String? get instagramUrl => raw['social.instagram'] as String?;
  String? get facebookUrl => raw['social.facebook'] as String?;
  String? get xUrl => raw['social.twitter'] as String?;
  String? get youtubeUrl => raw['social.youtube'] as String?;
  bool get taxEnabled => raw['tax.enabled'] as bool? ?? true;
  double get taxRate => (raw['tax.rate'] as num?)?.toDouble() ?? 0;
  int get shippingFee => (raw['shipping.fee'] as num?)?.toInt() ?? 0;
  int get freeShippingThreshold =>
      (raw['shipping.freeThreshold'] as num?)?.toInt() ?? 0;
}

final storeSettingsProvider = FutureProvider<StoreSettings>((ref) async {
  final client = ref.watch(dioClientProvider);
  final result = await _fetchSettings(client);
  return StoreSettings(result);
});

Future<Map<String, dynamic>> _fetchSettings(DioClient client) async {
  final result = await client.get<Map<String, dynamic>>(
    ApiEndpoints.settings,
    decode: (json) => json! as Map<String, dynamic>,
  );
  return result.data;
}
