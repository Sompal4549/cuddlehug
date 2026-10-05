import 'package:cuddlehug_app/core/utils/money.dart';

/// Display formatting. Dates are always rendered in IST (UTC+05:30, no DST —
/// plan §4.3).
DateTime toIst(DateTime value) =>
    value.toUtc().add(const Duration(hours: 5, minutes: 30));

/// `₹1,49,000.00` — Indian digit grouping, always 2 decimals.
String formatMoney(Money money) => '₹${formatAmount(money)}';

/// `1,49,000.00` — grouping without the currency symbol (for joined labels).
String formatAmount(Money money) {
  final negative = money.minorUnits.isNegative;
  final abs = money.minorUnits.abs();
  final rupees = abs ~/ 100;
  final paise = (abs % 100).toString().padLeft(2, '0');
  return '${negative ? '-' : ''}${_groupIndian(rupees.toString())}.$paise';
}

/// Indian digit grouping: `149000` → `1,49,000`.
String _groupIndian(String digits) {
  if (digits.length <= 3) return digits;
  final lastThree = digits.substring(digits.length - 3);
  var rest = digits.substring(0, digits.length - 3);
  final leading = <String>[];
  while (rest.length > 2) {
    leading.insert(0, rest.substring(rest.length - 2));
    rest = rest.substring(0, rest.length - 2);
  }
  if (rest.isNotEmpty) leading.insert(0, rest);
  return [...leading, lastThree].join(',');
}

/// `12 Oct 2026`
String formatDate(DateTime value) {
  final d = toIst(value);
  return '${d.day} ${_month(d.month)} ${d.year}';
}

/// `12 Oct 2026, 4:30 pm`
String formatDateTime(DateTime value) {
  final d = toIst(value);
  final hour = d.hour % 12 == 0 ? 12 : d.hour % 12;
  final minute = d.minute.toString().padLeft(2, '0');
  final period = d.hour < 12 ? 'am' : 'pm';
  return '${formatDate(value)}, $hour:$minute $period';
}

String _month(int month) => const [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
][month - 1];
