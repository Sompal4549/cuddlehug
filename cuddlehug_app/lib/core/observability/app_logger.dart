import 'package:cuddlehug_app/core/config/app_config.dart';
import 'package:cuddlehug_app/core/security/log_sanitizer.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Structured, vendor-neutral logging.
///
/// The app never talks to a logging SDK directly — screens, controllers and
/// repositories depend on this interface so a vendor (or a log shipper) can
/// be plugged in later by overriding `appLoggerProvider`. Every message and
/// field passes through [LogSanitizer] before it leaves the process, so a
/// call site can never leak a token by accident.
abstract interface class AppLogger {
  void debug(String message, {Map<String, Object?> fields});

  void info(String message, {Map<String, Object?> fields});

  void warning(String message, {Map<String, Object?> fields});

  void error(String message, {Map<String, Object?> fields});
}

/// Swallows everything — the default outside debug builds, where there is
/// nowhere sensible to ship logs yet.
class NoopAppLogger implements AppLogger {
  const new();

  @override
  void debug(String message, {Map<String, Object?> fields = const {}}) {}

  @override
  void info(String message, {Map<String, Object?> fields = const {}}) {}

  @override
  void warning(String message, {Map<String, Object?> fields = const {}}) {}

  @override
  void error(String message, {Map<String, Object?> fields = const {}}) {}
}

/// Debug-build logger: `debugPrint`, redacted, and only active when the
/// build config opts in via `ENABLE_LOGGING`.
class DebugAppLogger implements AppLogger {
  const new({this.scope});

  /// Optional subsystem name prefixed to every message (`auth`, `api`, …).
  final String? scope;

  @override
  void debug(String message, {Map<String, Object?> fields = const {}}) =>
      _write('D', message, fields);

  @override
  void info(String message, {Map<String, Object?> fields = const {}}) =>
      _write('I', message, fields);

  @override
  void warning(String message, {Map<String, Object?> fields = const {}}) =>
      _write('W', message, fields);

  @override
  void error(String message, {Map<String, Object?> fields = const {}}) =>
      _write('E', message, fields);

  void _write(String level, String message, Map<String, Object?> fields) {
    assert(() {
      final name = scope;
      final header = name == null ? '[$level]' : '[$level][$name]';
      final suffix = fields.entries
          .map(
            (entry) =>
                '${entry.key}=${LogSanitizer.sanitizeField(entry.key, entry.value)}',
          )
          .join(' ');
      final body = LogSanitizer.sanitize(message);
      debugPrint(suffix.isEmpty ? '$header $body' : '$header $body $suffix');
      return true;
    }(), 'log');
  }
}

/// Builds the process logger.
///
/// Release builds get [NoopAppLogger] regardless of config — production log
/// shipping is a crash-reporting/telemetry concern, not a `debugPrint`.
AppLogger createAppLogger() {
  if (!kDebugMode || !AppConfig.current.enableLogging) {
    return const NoopAppLogger();
  }
  return const DebugAppLogger(scope: 'app');
}

/// Provided by `ProviderScope`; override to route logs to a vendor SDK.
final Provider<AppLogger> appLoggerProvider = Provider<AppLogger>(
  (ref) => createAppLogger(),
);
