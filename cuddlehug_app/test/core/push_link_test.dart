import 'package:cuddlehug_app/core/push/push_link.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('pushRouteFor', () {
    test('order pushes deep-link to the order detail screen', () {
      expect(
        pushRouteFor(<String, String>{'type': 'SHIPPING', 'orderId': 'o1'}),
        '/orders/o1',
      );
    });

    test('product pushes deep-link to the product screen', () {
      expect(
        pushRouteFor(<String, String>{
          'type': 'GENERAL',
          'productSlug': 'bear',
        }),
        '/product/bear',
      );
    });

    test('orderId wins when both keys are present', () {
      expect(
        pushRouteFor(<String, String>{'orderId': 'o1', 'productSlug': 'bear'}),
        '/orders/o1',
      );
    });

    test('unknown or empty payloads land on home', () {
      expect(pushRouteFor(const <String, String>{}), '/');
      expect(pushRouteFor(<String, String>{'orderId': ''}), '/');
      expect(pushRouteFor(<String, String>{'type': 'GENERAL'}), '/');
    });
  });

  group('pushDataFromPayload', () {
    test('parses encoded payload round-trip', () {
      final payload = Uri(
        queryParameters: <String, String>{'type': 'SHIPPING', 'orderId': 'o1'},
      ).query;
      expect(pushDataFromPayload(payload), <String, String>{
        'type': 'SHIPPING',
        'orderId': 'o1',
      });
    });

    test('tolerates null, empty and malformed payloads', () {
      expect(pushDataFromPayload(null), isEmpty);
      expect(pushDataFromPayload(''), isEmpty);
      expect(pushDataFromPayload('%'), isEmpty);
    });
  });
}
