import 'package:cuddlehug_app/app.dart';
import 'package:cuddlehug_app/app_providers.dart';
import 'package:cuddlehug_app/core/storage/prefs_store.dart';
import 'package:cuddlehug_app/core/storage/secure_store.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

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
      ],
      child: const CuddleHugApp(),
    ),
  );
}
