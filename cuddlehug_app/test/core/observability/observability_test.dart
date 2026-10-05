import 'package:cuddlehug_app/core/observability/app_logger.dart';
import 'package:cuddlehug_app/core/observability/crash_reporter.dart';
import 'package:cuddlehug_app/core/observability/performance_monitor.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

class _RecordingLogger implements AppLogger {
  final List<String> entries = <String>[];

  String _line(String level, String message, Map<String, Object?> fields) {
    final suffix = fields.entries.map((e) => '${e.key}=${e.value}').join(' ');
    return suffix.isEmpty ? '$level $message' : '$level $message $suffix';
  }

  @override
  void debug(String message, {Map<String, Object?> fields = const {}}) =>
      entries.add(_line('D', message, fields));

  @override
  void info(String message, {Map<String, Object?> fields = const {}}) =>
      entries.add(_line('I', message, fields));

  @override
  void warning(String message, {Map<String, Object?> fields = const {}}) =>
      entries.add(_line('W', message, fields));

  @override
  void error(String message, {Map<String, Object?> fields = const {}}) =>
      entries.add(_line('E', message, fields));
}

void main() {
  group('AppLogger', () {
    late List<String> printed;
    late DebugPrintCallback original;

    setUp(() {
      original = debugPrint;
      printed = <String>[];
      debugPrint = (message, {wrapWidth}) {
        if (message != null) printed.add(message);
      };
    });

    tearDown(() => debugPrint = original);

    test('NoopAppLogger drops every level without throwing', () {
      const logger = NoopAppLogger();
      logger
        ..debug('d')
        ..info('i')
        ..warning('w')
        ..error('e');
      expect(printed, isEmpty);
    });

    test('DebugAppLogger redacts secrets in the message and in fields', () {
      const authLogger = DebugAppLogger(scope: 'auth');
      authLogger.error(
        'refresh failed for ada@example.com',
        fields: {
          'accessToken': 'eyJhbGciOiJIUzI1NiJ9.payload.signature',
          'password': 'hunter2',
          'status': 401,
        },
      );

      expect(printed, hasLength(1));
      final line = printed.single;
      expect(line, startsWith('[E][auth]'));
      expect(line, contains('a***@example.com'));
      expect(line, isNot(contains('ada@example.com')));
      expect(line, contains('accessToken=***'));
      expect(line, contains('password=***'));
      expect(line, contains('status=401'));
      expect(line, isNot(contains('hunter2')));
      expect(line, isNot(contains('eyJhbGciOiJIUzI1NiJ9')));
    });

    test('createAppLogger never returns null and honours ENABLE_LOGGING', () {
      expect(createAppLogger(), isNotNull);
      // Test builds are debug with logging enabled, so the real logger.
      expect(createAppLogger(), isA<DebugAppLogger>());
    });
  });

  group('InMemoryPerformanceMonitor', () {
    late _RecordingLogger logger;
    late InMemoryPerformanceMonitor monitor;

    setUp(() {
      logger = _RecordingLogger();
      monitor = InMemoryPerformanceMonitor(logger: logger, maxEntries: 3);
    });

    ApiCallMetric metric({
      int? status = 200,
      Duration duration = const Duration(milliseconds: 12),
      bool transportFailure = false,
    }) => ApiCallMetric(
      category: 'catalog',
      method: 'GET',
      duration: duration,
      statusCode: status,
      transportFailure: transportFailure,
    );

    test('keeps a bounded window, dropping the oldest measurement', () {
      for (var i = 0; i < 5; i++) {
        monitor.recordApiCall(metric());
      }

      expect(monitor.measurements, hasLength(3));
      expect(logger.entries, isEmpty);
    });

    test('the exposed window is read-only', () {
      monitor.recordApiCall(metric());
      expect(() => monitor.measurements.clear(), throwsUnsupportedError);
    });

    test('clear empties the window', () {
      monitor
        ..recordApiCall(metric())
        ..clear();
      expect(monitor.measurements, isEmpty);
    });

    test('warns on a transport failure and on a 5xx', () {
      monitor
        ..recordApiCall(metric(status: null, transportFailure: true))
        ..recordApiCall(metric(status: 503));

      expect(logger.entries, hasLength(2));
      expect(
        logger.entries.every((e) => e.contains('api call failed')),
        isTrue,
      );
    });

    test('keeps quiet for a fast successful call', () {
      monitor.recordApiCall(metric());
      expect(logger.entries, isEmpty);
    });

    test('logs a slow but successful call', () {
      monitor.recordApiCall(
        metric(duration: InMemoryPerformanceMonitor.slowThreshold),
      );

      expect(logger.entries, hasLength(1));
      expect(logger.entries.single, contains('slow api call'));
    });
  });

  group('apiCategoryFor', () {
    test('maps endpoints to coarse, id-free categories', () {
      expect(apiCategoryFor('/api/auth/login'), 'auth');
      expect(apiCategoryFor('/api/products/p1'), 'catalog');
      expect(apiCategoryFor('/api/categories'), 'catalog');
      expect(apiCategoryFor('/api/reviews'), 'catalog');
      expect(apiCategoryFor('/api/content/home'), 'catalog');
      expect(apiCategoryFor('/api/cart'), 'cart');
      expect(apiCategoryFor('/api/wishlist'), 'cart');
      expect(apiCategoryFor('/api/orders/o1'), 'orders');
      expect(apiCategoryFor('/api/payments/capture'), 'orders');
      expect(apiCategoryFor('/api/addresses'), 'account');
      expect(apiCategoryFor('/api/profile'), 'account');
      expect(apiCategoryFor('/api/notifications'), 'account');
      expect(apiCategoryFor('/api/settings'), 'settings');
      expect(apiCategoryFor('/api/unknown'), 'other');
    });

    test('ignores the query string so ids and tokens never leak', () {
      expect(apiCategoryFor('/api/orders/o1?token=abc&page=2'), 'orders');
      expect(apiCategoryFor('/api/products?slug=red-bear'), 'catalog');
    });

    test('handles paths without an /api segment', () {
      expect(apiCategoryFor('products/p1'), 'catalog');
      expect(apiCategoryFor('/'), 'other');
      expect(apiCategoryFor('/api'), 'other');
      expect(apiCategoryFor(''), 'other');
    });
  });

  group('DebugCrashReporter', () {
    late _RecordingLogger logger;
    late CrashReporter reporter;

    setUp(() {
      logger = _RecordingLogger();
      reporter = DebugCrashReporter(logger);
    });

    test('forwards the error with sanitized message and context', () {
      reporter.recordError(
        Exception('token=abc for ada@example.com'),
        StackTrace.current,
        reason: 'refresh failed',
        context: {
          'route': '/orders',
          'accessToken': 'super-secret',
          'latencyMs': 120,
        },
        fatal: true,
      );

      expect(logger.entries, hasLength(1));
      final line = logger.entries.single;
      expect(line, contains('E refresh failed'));
      expect(line, contains('token=***'));
      expect(line, contains('a***@example.com'));
      expect(line, contains('route=/orders'));
      expect(line, contains('accessToken=***'));
      expect(line, contains('latencyMs=120'));
      expect(line, contains('fatal=true'));
      expect(line, isNot(contains('super-secret')));
    });

    test('log() lands as an informational event', () {
      reporter.log('order placed', fields: {'orderId': 'o1'});
      expect(logger.entries.single, contains('I order placed'));
      expect(logger.entries.single, contains('orderId=o1'));
    });

    test('user context is accepted without throwing', () {
      expect(
        () => reporter.setUserContext(userId: 'u1', environment: 'prod'),
        returnsNormally,
      );
    });

    test('createCrashReporter builds the default reporter', () {
      expect(createCrashReporter(), isA<DebugCrashReporter>());
    });
  });
}
