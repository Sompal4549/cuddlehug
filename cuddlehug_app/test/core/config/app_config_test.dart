import 'package:cuddlehug_app/core/config/app_config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  AppConfig build({
    String apiBaseUrl = 'https://api.cuddlehug.com',
    String webAssetBase = 'https://cuddlehug.com',
    String environment = 'prod',
    bool enableLogging = false,
  }) => AppConfig(
    apiBaseUrl: apiBaseUrl,
    webAssetBase: webAssetBase,
    environment: environment,
    enableLogging: enableLogging,
  );

  group('environment flags', () {
    test('maps dev/staging/prod to exactly one flag', () {
      expect(build(environment: 'dev').isDev, isTrue);
      expect(build(environment: 'staging').isStaging, isTrue);
      expect(build().isProd, isTrue);

      expect(build(environment: 'dev').isProd, isFalse);
      expect(build(environment: 'staging').isDev, isFalse);
    });

    test('only dev may use plain HTTP', () {
      expect(build(environment: 'dev').allowsInsecureHttp, isTrue);
      expect(build(environment: 'staging').allowsInsecureHttp, isFalse);
      expect(build().allowsInsecureHttp, isFalse);
    });
  });

  group('validateBaseUrl', () {
    List<String> check(String url, {required bool allowInsecure}) =>
        AppConfig.validateBaseUrl(url, allowInsecure: allowInsecure);

    test('accepts https anywhere', () {
      expect(check('https://api.cuddlehug.com', allowInsecure: false), isEmpty);
      expect(check('https://api.cuddlehug.com', allowInsecure: true), isEmpty);
    });

    test('rejects http outside dev', () {
      expect(check('http://10.0.2.2:5000', allowInsecure: false), isNotEmpty);
      expect(check('http://10.0.2.2:5000', allowInsecure: true), isEmpty);
    });

    test('rejects a relative or scheme-less URL', () {
      expect(check('/api', allowInsecure: true), isNotEmpty);
      expect(check('api.cuddlehug.com', allowInsecure: true), isNotEmpty);
      expect(check('', allowInsecure: true), isNotEmpty);
    });

    test('rejects a non-http(s) scheme', () {
      expect(
        check('ftp://files.cuddlehug.com', allowInsecure: true),
        isNotEmpty,
      );
      expect(check('javascript:alert(1)', allowInsecure: true), isNotEmpty);
    });

    test(
      'rejects credentials embedded in the authority',
      () => expect(
        check('https://user:pass@api.cuddlehug.com', allowInsecure: false),
        isNotEmpty,
      ),
    );
  });

  group('validate', () {
    test('a production-shaped config passes', () {
      expect(build().validate(), isEmpty);
    });

    test('a dev config with the emulator loopback passes', () {
      expect(
        build(
          apiBaseUrl: 'http://10.0.2.2:5000',
          webAssetBase: 'http://localhost:3000',
          environment: 'dev',
          enableLogging: true,
        ).validate(),
        isEmpty,
      );
    });

    test('an unknown environment is reported', () {
      expect(
        build(environment: 'qa').validate().join(' '),
        contains('ENVIRONMENT must be one of'),
      );
    });

    test('logging in production is reported', () {
      expect(
        build(enableLogging: true).validate().join(' '),
        contains('ENABLE_LOGGING must be false'),
      );
    });

    test('http in production is reported', () {
      expect(
        build(apiBaseUrl: 'http://api.cuddlehug.com').validate().join(' '),
        contains('must use https'),
      );
    });

    test('credentials in the API URL are reported', () {
      expect(
        build(apiBaseUrl: 'https://u:p@api.cuddlehug.com').validate().join(' '),
        contains('must not embed credentials'),
      );
    });
  });

  group('ensureValid', () {
    test('passes a safe config', () {
      expect(() => AppConfig.ensureValid(config: build()), returnsNormally);
    });

    test('throws a StateError carrying every problem', () {
      expect(
        () => AppConfig.ensureValid(
          config: build(
            apiBaseUrl: 'http://api.cuddlehug.com',
            webAssetBase: 'http://cuddlehug.com',
            environment: 'qa',
          ),
        ),
        throwsA(
          isA<StateError>().having(
            (e) => e.message,
            'message',
            allOf(
              contains('API_BASE_URL'),
              contains('WEB_ASSET_BASE'),
              contains('ENVIRONMENT'),
            ),
          ),
        ),
      );
    });

    test('rejects a production build with logging left on', () {
      expect(
        () => AppConfig.ensureValid(config: build(enableLogging: true)),
        throwsA(
          isA<StateError>().having(
            (e) => e.message,
            'message',
            contains('ENABLE_LOGGING'),
          ),
        ),
      );
    });
  });
}
