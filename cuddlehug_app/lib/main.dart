import 'dart:ui' show PlatformDispatcher;

import 'package:cuddlehug_app/app.dart';
import 'package:cuddlehug_app/app_providers.dart';
import 'package:cuddlehug_app/core/config/app_config.dart';
import 'package:cuddlehug_app/core/observability/app_logger.dart';
import 'package:cuddlehug_app/core/observability/crash_reporter.dart';
import 'package:cuddlehug_app/core/storage/prefs_store.dart';
import 'package:cuddlehug_app/core/storage/secure_store.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Refuse to boot a build whose flavor config would ship an insecure URL,
  // a unknown environment or logging in production.
  AppConfig.ensureValid();

  // Observability is installed *before* the first frame so nothing that
  // happens during bootstrap is lost.
  final appLogger = createAppLogger();
  final crashReporter = DebugCrashReporter(appLogger);
  FlutterError.onError = (details) => crashReporter.recordError(
    details.exception,
    details.stack ?? StackTrace.current,
    reason: details.context?.toDescription(),
  );
  // Returning `true` keeps the framework's own red screen / dialog behaviour
  // and guarantees a second-level error cannot take the app down silently.
  PlatformDispatcher.instance.onError = (error, stackTrace) {
    crashReporter.recordError(error, stackTrace, fatal: true);
    return true;
  };

  // Hydrate local stores (refresh token, guest cart session, user snapshot)
  // before the first frame so interceptors never race an empty cache.
  final secureStore = SecureStore();
  await secureStore.hydrate();
  final prefsStore = await PrefsStore.load();

  runApp(
    ProviderScope(
      overrides: [
        secureStoreProvider.overrideWithValue(secureStore),
        prefsStoreProvider.overrideWithValue(prefsStore),
        appLoggerProvider.overrideWithValue(appLogger),
        crashReporterProvider.overrideWithValue(crashReporter),
      ],
      child: const CuddleHugApp(),
    ),
  );
}
