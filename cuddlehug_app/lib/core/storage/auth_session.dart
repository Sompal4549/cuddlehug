/// In-memory session state (plan §5.2).
///
/// The access token NEVER touches disk — it lives here for the process
/// lifetime and is dropped on logout or refresh failure. The refresh token
/// and `ch_sid` go to the encrypted SecureStore.
///
/// Expiry is **single-fire**: N concurrent requests can fail their refresh at
/// the same time, but [onSessionExpired] runs exactly once per authenticated
/// session, so the app performs one logout / one snackbar / one router
/// re-evaluation instead of N.
class AuthSession {
  String? _accessToken;
  bool _expired = false;
  bool _hadSession = false;

  String? get accessToken => _accessToken;

  /// `true` once the refresh path has proved the session dead. Cleared when a
  /// fresh access token arrives (login / successful refresh).
  bool get isExpired => _expired;

  /// `true` when this process has ever held a token since the last [clear].
  bool get hasAuthenticated => _hadSession;

  set accessToken(String? value) {
    _accessToken = value;
    if (value != null) {
      _expired = false;
      _hadSession = true;
      onAccessTokenSet?.call(value);
    }
  }

  /// Fired on every newly issued access token (login/refresh) so the auth
  /// feature can schedule a proactive refresh before it expires.
  void Function(String accessToken)? onAccessTokenSet;

  /// Fired when the refresh path fails (token revoked/expired) so the auth
  /// feature can wipe state and route the user to login. Not fired by local
  /// logout — that flow navigates on its own. Never fired for a session that
  /// was never established (guests), and never twice for the same session.
  void Function()? onSessionExpired;

  /// Local logout — forgets the token and the expiry latch without firing
  /// [onSessionExpired] (the logout flow navigates on its own).
  void clear() {
    _accessToken = null;
    _expired = false;
    _hadSession = false;
  }

  /// Refresh failed for good: drop the token and notify exactly once.
  void expire() {
    _accessToken = null;
    if (_expired || !_hadSession) return;
    _expired = true;
    onSessionExpired?.call();
  }
}
