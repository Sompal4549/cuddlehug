import 'package:cuddlehug_app/core/utils/formatters.dart';
import 'package:cuddlehug_app/core/utils/money.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Money', () {
    test('parses backend decimal strings', () {
      expect(Money.parse('499.00').minorUnits, 49900);
      expect(Money.parse('0').minorUnits, 0);
      expect(Money.parse('12.5').minorUnits, 1250);
      expect(Money.parse(null).minorUnits, 0);
      expect(Money.parse('').minorUnits, 0);
      expect(Money.parse('not-a-price').minorUnits, 0);
      expect(Money.parse(499).minorUnits, 49900);
    });

    test('arithmetic stays in integer minor units', () {
      expect((Money.parse('0.10') + Money.parse('0.20')).minorUnits, 30);
      expect(
        (Money.parse('499.00') - Money.parse('99.00')).toString(),
        '400.00',
      );
    });
  });

  group('formatAmount', () {
    test('uses Indian digit grouping', () {
      expect(formatAmount(Money.parse('149000')), '1,49,000.00');
      expect(formatAmount(Money.parse('499')), '499.00');
      expect(formatAmount(Money.parse('1000')), '1,000.00');
      expect(formatAmount(Money.parse('100000')), '1,00,000.00');
      expect(formatAmount(Money.parse('10000000')), '1,00,00,000.00');
      expect(formatAmount(Money.zero), '0.00');
      expect(formatAmount(const Money(-15050)), '-150.50');
    });

    test('formatMoney prefixes the rupee symbol', () {
      expect(formatMoney(Money.parse('499')), '₹499.00');
    });
  });

  group('dates render in IST', () {
    test('formatDate converts from UTC', () {
      // 2026-10-01T00:00:00Z → 01 Oct 2026, 05:30 IST (same date).
      final utc = DateTime.utc(2026, 10);
      expect(formatDate(utc), '1 Oct 2026');
      // Late-evening UTC rolls to the next day in IST.
      expect(formatDate(DateTime.utc(2026, 9, 30, 20)), '1 Oct 2026');
    });

    test('formatDateTime includes 12-hour time', () {
      final utc = DateTime.utc(2026, 10, 1, 10); // 15:30 IST
      expect(formatDateTime(utc), '1 Oct 2026, 3:30 pm');
      final midnight = DateTime.utc(2026, 9, 30, 18, 30); // 00:00 IST
      expect(formatDateTime(midnight), '1 Oct 2026, 12:00 am');
    });
  });
}
