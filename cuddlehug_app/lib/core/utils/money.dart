import 'package:flutter/foundation.dart';

/// Integer-minor-unit money (backend uses decimal strings; integer paise
/// internally — plan §4.3). Never use `double` for money.
@immutable
class Money implements Comparable<Money> {
  const new(this.minorUnits);

  /// Parses backend decimal strings like `"499.00"` or `"0"`.
  factory parse(Object? raw) {
    if (raw is num) return Money((raw * 100).round());
    final text = (raw ?? '').toString().trim();
    if (text.isEmpty) return zero;
    final value = double.tryParse(text);
    if (value == null) return zero;
    return Money((value * 100).round());
  }

  static const zero = Money(0);

  final int minorUnits;

  bool get isZero => minorUnits == 0;
  bool get isNegative => minorUnits < 0;

  Money operator +(Money other) => Money(minorUnits + other.minorUnits);
  Money operator -(Money other) => Money(minorUnits - other.minorUnits);
  Money operator *(int factor) => Money(minorUnits * factor);

  @override
  int compareTo(Money other) => minorUnits.compareTo(other.minorUnits);

  @override
  bool operator ==(Object other) =>
      other is Money && other.minorUnits == minorUnits;

  @override
  int get hashCode => minorUnits.hashCode;

  @override
  String toString() => (minorUnits / 100).toStringAsFixed(2);
}
