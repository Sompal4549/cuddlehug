/// Typed access to build-time configuration.
///
/// Values arrive via `--dart-define-from-file=config/{dev,staging,prod}.json`
/// (see README / CI). Defaults below target the Android emulator talking to
/// the local backend, so a bare `flutter run` works in dev.
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
    enableLogging:
        String.fromEnvironment('ENABLE_LOGGING', defaultValue: 'true') ==
        'true',
  );

  static const environments = <String>{'dev', 'staging', 'prod'};

  /// Backend origin, no trailing slash (endpoints include `/api/...`).
  final String apiBaseUrl;

  /// Next.js origin serving `/images/*` seeded assets.
  final String webAssetBase;

  /// dev | staging | prod.
  final String environment;

  final bool enableLogging;

  bool get isDev => environment == 'dev';

  bool get isStaging => environment == 'staging';

  bool get isProd => environment == 'prod';

  /// Only the dev environment may talk plain HTTP (emulator loopback).
  bool get allowsInsecureHttp => isDev;

  /// Problems found in this configuration. Empty means the build is safe to
  /// ship — called at bootstrap so a bad flavor config fails loudly instead
  /// of silently serving credentials over the wrong transport.
  List<String> validate() => <String>[
    ...validateBaseUrl(
      apiBaseUrl,
      allowInsecure: allowsInsecureHttp,
      label: 'API_BASE_URL',
    ),
    ...validateBaseUrl(
      webAssetBase,
      allowInsecure: allowsInsecureHttp,
      label: 'WEB_ASSET_BASE',
    ),
    if (!environments.contains(environment))
      'ENVIRONMENT must be one of ${environments.join(', ')} (got "$environment")',
    if (isProd && enableLogging)
      'ENABLE_LOGGING must be false in production builds',
  ];

  /// Validates a single absolute base URL.
  ///
  /// * must be `http(s)://` with a host,
  /// * must not embed credentials in the authority,
  /// * must be `https` unless [allowInsecure] (dev only).
  static List<String> validateBaseUrl(
    String url, {
    required bool allowInsecure,
    String label = 'URL',
  }) {
    final uri = Uri.tryParse(url);
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
      return ['$label is not an absolute URL: "$url"'];
    }
    if (uri.scheme != 'http' && uri.scheme != 'https') {
      return ['$label must use http(s), got "${uri.scheme}://": "$url"'];
    }
    if (uri.userInfo.isNotEmpty) {
      return ['$label must not embed credentials in the URL'];
    }
    if (uri.scheme == 'http' && !allowInsecure) {
      return ['$label must use https outside the dev environment: "$url"'];
    }
    return const [];
  }

  /// Throws when this build's configuration is unsafe. Call from bootstrap.
  static void ensureValid({AppConfig config = current}) {
    final problems = config.validate();
    if (problems.isNotEmpty) {
      throw StateError(
        'Unsafe build configuration for "${config.environment}": '
        '${problems.join('; ')}',
      );
    }
  }
}
