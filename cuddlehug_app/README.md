# CuddleHug App

Customer mobile app (Android + iOS) for CuddleHug. Flutter 3.47 / Dart 3.13,
Riverpod 3, go_router, Dio. Consumes the existing REST API in `../backend`.

Technical plan: [`../docs/FLUTTER_APP_PLAN.md`](../docs/FLUTTER_APP_PLAN.md).

## Environments

All environment data comes from `--dart-define-from-file=config/{dev,staging,prod}.json`
— no production URL is hardcoded in source (plan §20.1).

| | dev | staging | prod |
|---|---|---|---|
| API | `http://10.0.2.2:5000` (Android emulator) | `https://api-staging.cuddlehug.com` | `https://api.cuddlehug.com` |
| Web assets (`/images/*`) | `http://10.0.2.2:3000` | `https://staging.cuddlehug.com` | `https://cuddlehug.com` |
| Android app id | `com.cuddlehug.app.dev` | `com.cuddlehug.app.staging` | `com.cuddlehug.app` |
| Android label | CuddleHug Dev | CuddleHug Staging | CuddleHug |

> iOS simulator reaches the host at `http://localhost:5000` — override
> `API_BASE_URL`/`WEB_ASSET_BASE` when running there.

## Run

```bash
flutter pub get

# Android (local backend must be running on :5000, web on :3000)
flutter run --flavor dev --dart-define-from-file=config/dev.json

# Release builds
flutter build apk --flavor dev    --dart-define-from-file=config/dev.json
flutter build apk --flavor staging --dart-define-from-file=config/staging.json
flutter build appbundle --flavor prod --dart-define-from-file=config/prod.json

# iOS (macOS + Xcode only)
flutter build ios --no-codesign
```

Without `--dart-define-from-file` the defaults target the Android emulator
(`10.0.2.2`), so a bare `flutter run` works in dev.

## Quality gates

```bash
flutter analyze   # strict (very_good_analysis)
flutter test      # unit + widget tests (test/)
```

CI runs these on every PR plus Android APK, iOS (no-codesign), backend and
frontend suites — see `../.github/workflows/ci.yml`.

## Firebase / push provisioning (optional)

Push degrades gracefully without Firebase: `FcmPushService.init()` swallows the
missing-config error and `PushBootstrap` falls back to polling `unread-count`
every 60s, so badges and the in-app notification centre keep working.

To enable real FCM push (plan §9, backend B-8 already deployed):

```bash
npm i -g firebase-tools flutterfire_cli
firebase login
firebase projects:create cuddlehug-dev   # repeat per environment

# Generates lib/firebase_options.dart + android google-services.json
# + ios/Runner/GoogleService-Info.plist
flutterfire configure \
  --project=cuddlehug-dev \
  --platforms=android,ios \
  --out=lib/firebase_options.dart
```

Then in `lib/core/push/push_service.dart` change
`await Firebase.initializeApp();` to
`await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);`
and add the same `DefaultFirebaseOptions` import.

Per-environment setup (plan §20.1):

- one Firebase project per environment (dev/staging/prod) — pass the matching
  `--project` to `flutterfire configure`; keep the output in
  `lib/firebase_options_dev.dart` etc. and pick by `AppConfig.environment`.
- backend needs `FIREBASE_SERVICE_ACCOUNT` (per env) for `firebase-admin` to
  actually deliver pushes; without it `push.service.ts` no-ops.
- Android: `google-services.json` goes in `android/app/` (or
  `android/app/src/<flavor>/` for per-flavor files).
- iOS: `GoogleService-Info.plist` goes in `ios/Runner/`.
- Both files are public-by-design config, safe to commit.

## Project layout

```
lib/
├── main.dart            # bootstrap: stores → runApp
├── app.dart             # MaterialApp.router + offline banner + session/push wiring
├── core/                # config, theme, routing, network, storage, push, widgets
└── features/            # auth, home, catalog, cart, checkout, orders, account, …
```

Widgets never call Dio: presentation → controllers (Riverpod) → repository →
`DioClient` (plan §2.2).
