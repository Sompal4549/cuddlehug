/// In-memory session state (plan §5.2).
///
/// The access token NEVER touches disk — it lives here for the process
/// lifetime and is dropped on logout or refresh failure. The refresh token
/// and `ch_sid` go to the encrypted SecureStore.
class AuthSession {
  String? _accessToken;

  String? get accessToken => _accessToken;

  set accessToken(String? value) {
    _accessToken = value;
    if (value != null) onAccessTokenSet?.call(value);
  }

  /// Fired on every newly issued access token (login/refresh) so the auth
  /// feature can schedule a proactive refresh before it expires.
  void Function(String accessToken)? onAccessTokenSet;

  /// Fired when the refresh path fails (token revoked/expired) so the auth
  /// feature can wipe state and route the user to login. Not fired by local
  /// logout — that flow navigates on its own.
  void Function()? onSessionExpired;

  void clear() => _accessToken = null;

  void expire() {
    _accessToken = null;
    onSessionExpired?.call();
  }
}
