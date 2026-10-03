import 'package:cuddlehug_app/features/auth/presentation/validators.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('email rules mirror the backend', () {
    expect(validateEmail(null), 'Email is required');
    expect(validateEmail(''), 'Email is required');
    expect(validateEmail('nope'), 'Enter a valid email address');
    expect(validateEmail('a@b.co'), isNull);
    expect(validateEmail(' a@b.co '), isNull);
  });

  test('new password mirrors the backend zod rules', () {
    expect(validateNewPassword(''), 'Password is required');
    expect(validateNewPassword('abc1'), 'Password must be at least 8 characters');
    expect(validateNewPassword('12345678'), 'Password must contain a letter');
    expect(validateNewPassword('abcdefghi'), 'Password must contain a number');
    expect(validateNewPassword('abcd1234'), isNull);
  });

  test('names and phone mirror the backend', () {
    expect(validateFirstName('A'), 'First name is too short');
    expect(validateFirstName('Ada'), isNull);
    expect(validateLastName(''), 'Last name is required');
    expect(validateLastName('Lovelace'), isNull);
    expect(validatePhone(''), isNull);
    expect(validatePhone('+91 98765 43210'), isNull);
    expect(validatePhone('banana'), 'Enter a valid phone number');
  });
}
