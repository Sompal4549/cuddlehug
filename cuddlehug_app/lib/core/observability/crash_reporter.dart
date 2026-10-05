import 'package:cuddlehug_app/core/observability/app_logger.dart';
import 'package:cuddlehug_app/core/security/log_sanitizer.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Vendor-neutral crash / error reporting.
///
/// Everything that reports a failure depends on this interface rather than on
/// Sentry, Crashlytics, Bugsnag, … so a vendor can be added by overriding
/// `crashReporterProvider` without touching call sites. Payloads are
/// sanitized here so no secret can ride along in an error message or in
/// structured context.
abstract interface class CrashReporter {
  /// Records an unhandled/observed error with its stack trace.
  void recordError(
    Object error,
    StackTrace stackTrace, {
    String? reason,
    Map<String, Object?> context = const {},
    bool fatal = false,
  });

  /// Attaches non-sensitive key/value context to subsequent reports
  /// (route, user id, …).
  void setUserContext({String? userId, String? environment});

  /// Breadcrumbs / informational events (already sanitized upstream).
  void log(String message, {Map<String, Object?> fields = const {}});
}

/// Default reporter used until a vendor is configured: it forwards to
/// [AppLogger] in debug builds and drops everything in release, so the app
/// never pretends to have crash reporting it does not actually have.
class DebugCrashReporter implements CrashReporter {
  const new(this._logger);

  final AppLogger _logger;

  @override
  void recordError(
    Object error,
    StackTrace stackTrace, {
    String? reason,
    Map<String, Object?> context = const {},
    bool fatal = false,
  }) {
    _logger.error(
      reason ?? 'unhandled error',
      fields: {
        'error': LogSanitizer.sanitize(error.toString()),
        'fatal': fatal,
        ...context.map(
          (key, value) => MapEntry(key, LogSanitizer.sanitizeField(key, value)),
        ),
      },
    );
    assert(() {
      debugPrint(stackTrace.toString());
      return true;
    }(), 'stack');
  }

  @override
  void setUserContext({String? userId, String? environment}) {}

  @override
  void log(String message, {Map<String, Object?> fields = const {}}) =>
      _logger.info(message, fields: fields);
}

CrashReporter createCrashReporter() => DebugCrashReporter(createAppLogger());

/// Provided by `ProviderScope`; overridden in `main()` so `FlutterError` /
/// `PlatformDispatcher` hooks can be installed before the first frame.
final Provider<CrashReporter> crashReporterProvider = Provider<CrashReporter>(
  (ref) => createCrashReporter(),
);
