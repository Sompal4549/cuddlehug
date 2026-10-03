import 'package:cuddlehug_app/core/storage/secure_store.dart';
import 'package:dio/dio.dart';

/// Sends the guest cart session (`ch_sid`) with every request so the server
/// can associate an anonymous visitor with their cart (plan §6). The refresh
/// token is never put in a header — native clients send it in the request
/// body to `/auth/refresh` (backend B-1).
class CookieHeaderInterceptor extends Interceptor {
  new(this._store);

  final SecureStore _store;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final sid = _store.sessionId;
    if (sid != null && sid.isNotEmpty) {
      options.headers['Cookie'] = 'ch_sid=$sid';
    }
    handler.next(options);
  }
}
