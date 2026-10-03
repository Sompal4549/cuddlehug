/// Typed access to build-time configuration.
///
/// Values arrive via `--dart-define-from-file=config/{dev,staging,prod}.json`
/// (see `tool/run.sh` / CI). Defaults below target the Android emulator
/// talking to the local backend, so a bare `flutter run` works in dev.
class AppConfig {
  const new({
    required this.apiBaseUrl,
    required this.webAssetBase,
    required this.environment,
    required this.enableLogging,
  });

  static const AppConfig current = AppConfig(
    apiBaseUrl: String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://10.0.2.2:5000',
    ),
    webAssetBase: String.fromEnvironment(
      'WEB_ASSET_BASE',
      defaultValue: 'http://localhost:3000',
    ),
    environment: String.fromEnvironment('ENVIRONMENT', defaultValue: 'dev'),
    enableLogging: String.fromEnvironment('ENABLE_LOGGING', defaultValue: 'true') == 'true',
  );

  /// Backend origin, no trailing slash (endpoints include `/api/...`).
  final String apiBaseUrl;

  /// Next.js origin serving `/images/*` seeded assets.
  final String webAssetBase;

  /// dev | staging | prod.
  final String environment;

  final bool enableLogging;

  bool get isDev => environment == 'dev';
}
