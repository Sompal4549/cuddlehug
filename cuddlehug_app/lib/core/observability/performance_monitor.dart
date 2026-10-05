import 'package:cuddlehug_app/core/observability/app_logger.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// One observed API round-trip. Carries only non-sensitive descriptors —
/// never URLs with query strings, headers or bodies.
@immutable
class ApiCallMetric {
  const new({
    required this.category,
    required this.method,
    required this.duration,
    this.statusCode,
    this.transportFailure = false,
    this.retried = false,
  });

  /// Coarse endpoint group derived from the path (`auth`, `catalog`,
  /// `cart`, `orders`, `payments`, `account`, `content`, `other`).
  final String category;

  final String method;

  final Duration duration;

  /// `null` when the request never produced an HTTP response.
  final int? statusCode;

  /// Transport-level failure (no response: DNS/timeout/socket).
  final bool transportFailure;

  /// Whether the retry interceptor spent budget on this request.
  final bool retried;

  bool get failed =>
      transportFailure || (statusCode != null && statusCode! >= 400);
}

/// Aggregates request timings so slow endpoints and error rates are visible
/// without attaching a vendor SDK.
abstract interface class PerformanceMonitor {
  void recordApiCall(ApiCallMetric metric);

  /// Recorded measurements, oldest first (bounded).
  List<ApiCallMetric> get measurements;

  void clear();
}

/// Keeps a bounded in-memory window and echoes slow/failed calls to the
/// [AppLogger]. Production builds drop the log line but keep the aggregate
/// so a future telemetry backend can flush `measurements`.
class InMemoryPerformanceMonitor implements PerformanceMonitor {
  new({this.logger, this.maxEntries = 100});

  final AppLogger? logger;
  final int maxEntries;
  final List<ApiCallMetric> _measurements = <ApiCallMetric>[];

  /// Calls slower than this are surfaced as warnings in debug logs.
  static const slowThreshold = Duration(milliseconds: 2000);

  @override
  List<ApiCallMetric> get measurements => List.unmodifiable(_measurements);

  @override
  void recordApiCall(ApiCallMetric metric) {
    _measurements.add(metric);
    if (_measurements.length > maxEntries) {
      _measurements.removeAt(0);
    }
    final logger = this.logger;
    if (logger == null) return;
    if (metric.transportFailure || (metric.statusCode ?? 200) >= 500) {
      logger.warning('api call failed', fields: _fields(metric));
    } else if (metric.duration >= slowThreshold) {
      logger.info('slow api call', fields: _fields(metric));
    }
  }

  @override
  void clear() => _measurements.clear();

  static Map<String, Object?> _fields(ApiCallMetric metric) => {
    'method': metric.method,
    'category': metric.category,
    'status': metric.statusCode,
    'ms': metric.duration.inMilliseconds,
    'retried': metric.retried,
  };
}

final Provider<PerformanceMonitor> performanceMonitorProvider =
    Provider<PerformanceMonitor>(
      (ref) => InMemoryPerformanceMonitor(logger: ref.watch(appLoggerProvider)),
    );

/// Coarse path → category mapping used for telemetry. Deliberately blunt:
/// it must never encode ids, slugs or query strings.
String apiCategoryFor(String path) {
  final segments = path
      .split('?')
      .first
      .split('/')
      .where((segment) => segment.isNotEmpty)
      .toList();
  final apiIndex = segments.indexOf('api');
  final tail = apiIndex >= 0 ? segments.skip(apiIndex + 1).toList() : segments;
  if (tail.isEmpty) return 'other';
  return switch (tail.first) {
    'auth' => 'auth',
    'products' || 'categories' || 'reviews' || 'content' => 'catalog',
    'cart' || 'wishlist' => 'cart',
    'orders' || 'payments' => 'orders',
    'addresses' || 'profile' || 'notifications' || 'devices' => 'account',
    'settings' => 'settings',
    _ => 'other',
  };
}
