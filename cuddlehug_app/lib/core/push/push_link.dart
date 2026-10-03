/// Maps a push payload (`data` map from the backend) to an in-app route.
///
/// Backend sends `{type, orderId?}` for order/payment pushes (plan §9.3);
/// `productSlug` is reserved for future promo pushes. Unknown or empty
/// payloads land on the home tab.
String pushRouteFor(Map<String, String> data) {
  final orderId = data['orderId'] ?? '';
  if (orderId.isNotEmpty) return '/orders/$orderId';
  final slug = data['productSlug'] ?? '';
  if (slug.isNotEmpty) return '/product/$slug';
  return '/';
}

/// Parses a raw payload string (from a local-notification tap) back into
/// the data map. Returns an empty map for null/unparseable payloads.
Map<String, String> pushDataFromPayload(String? payload) {
  if (payload == null || payload.isEmpty) return const <String, String>{};
  try {
    return Uri.splitQueryString(payload);
  } on Object {
    // Malformed percent-encoding throws FormatException/ArgumentError.
    return const <String, String>{};
  }
}
