import 'package:cuddlehug_app/core/config/app_config.dart';

/// Resolves backend-relative and seeded image paths to absolute URLs
/// (plan §4.5):
/// - `http(s)://` or `data:` → unchanged
/// - `/images/…` → seeded assets living in `frontend/public` → webAssetBase
/// - anything else (`/uploads/…`) → API base
/// - empty → placeholder asset
String resolveImageUrl(String? url) {
  if (url == null || url.trim().isEmpty) return 'assets/images/placeholder.png';
  final trimmed = url.trim();
  if (trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('data:')) {
    return trimmed;
  }
  if (trimmed.startsWith('/images/')) {
    return '${AppConfig.current.webAssetBase}$trimmed';
  }
  return '${AppConfig.current.apiBaseUrl}$trimmed';
}
