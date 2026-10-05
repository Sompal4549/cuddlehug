import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Non-sensitive local preferences (plan §5.2): the user snapshot for
/// instant cold-start UI, plus misc flags. Sensitive tokens never land here.
class PrefsStore {
  new(this._prefs);

  static const _userKey = 'auth.user';
  static const _recentSearchesKey = 'search.recent';
  static const _maxRecentSearches = 8;

  final SharedPreferences _prefs;

  static Future<PrefsStore> load() async =>
      PrefsStore(await SharedPreferences.getInstance());

  Map<String, dynamic>? readUserSnapshot() {
    final raw = _prefs.getString(_userKey);
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw);
      return decoded is Map<String, dynamic> ? decoded : null;
    } on FormatException {
      return null;
    }
  }

  Future<void> writeUserSnapshot(Map<String, dynamic> user) =>
      _prefs.setString(_userKey, jsonEncode(user));

  Future<void> clearUserSnapshot() => _prefs.remove(_userKey);

  /// Recent shop searches, newest first (deduped, capped at 8).
  List<String> readRecentSearches() =>
      _prefs.getStringList(_recentSearchesKey) ?? const [];

  Future<void> addRecentSearch(String term) async {
    final trimmed = term.trim();
    if (trimmed.isEmpty) return;
    final current = readRecentSearches()
      ..removeWhere((entry) => entry.toLowerCase() == trimmed.toLowerCase())
      ..insert(0, trimmed);
    await _prefs.setStringList(
      _recentSearchesKey,
      current.take(_maxRecentSearches).toList(),
    );
  }

  Future<void> clearRecentSearches() => _prefs.remove(_recentSearchesKey);
}
