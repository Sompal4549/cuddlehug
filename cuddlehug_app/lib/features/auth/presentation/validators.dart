/// Client-side validators mirroring the backend zod schemas exactly
/// (plan §5 — same messages so users see one consistent rule set).
String? validateEmail(String? value) {
  final v = value?.trim() ?? '';
  if (v.isEmpty) return 'Email is required';
  if (v.length > 160) return 'Email is too long';
  if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v)) {
    return 'Enter a valid email address';
  }
  return null;
}

String? validateRequiredPassword(String? value) {
  if (value == null || value.isEmpty) return 'Password is required';
  return null;
}

String? validateNewPassword(String? value) {
  final v = value ?? '';
  if (v.isEmpty) return 'Password is required';
  if (v.length < 8) return 'Password must be at least 8 characters';
  if (v.length > 72) return 'Password must be at most 72 characters';
  if (!RegExp('[A-Za-z]').hasMatch(v)) return 'Password must contain a letter';
  if (!RegExp('[0-9]').hasMatch(v)) return 'Password must contain a number';
  return null;
}

String? validateFirstName(String? value) {
  final v = value?.trim() ?? '';
  if (v.isEmpty) return 'First name is required';
  if (v.length < 2) return 'First name is too short';
  if (v.length > 60) return 'First name is too long';
  return null;
}

String? validateLastName(String? value) {
  final v = value?.trim() ?? '';
  if (v.isEmpty) return 'Last name is required';
  if (v.length > 60) return 'Last name is too long';
  return null;
}

/// Optional phone — empty is allowed, but a filled value must match.
String? validatePhone(String? value) {
  final v = value?.trim() ?? '';
  if (v.isEmpty) return null;
  if (!RegExp(r'^[+]?[0-9][0-9\s-]{7,15}$').hasMatch(v)) {
    return 'Enter a valid phone number';
  }
  return null;
}
