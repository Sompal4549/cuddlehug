import 'package:cuddlehug_app/app_providers.dart';
import 'package:cuddlehug_app/core/network/api_endpoints.dart';
import 'package:cuddlehug_app/core/network/dio_client.dart';
import 'package:cuddlehug_app/core/network/paged.dart';
import 'package:cuddlehug_app/features/account/data/models/app_notification.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Notification inbox (`/api/notifications`, all `requireAuth`).
final notificationRepositoryProvider = Provider<NotificationRepository>(
  (ref) => NotificationRepository(ref.watch(dioClientProvider)),
);

class NotificationRepository {
  new(this._client);

  final DioClient _client;

  Future<NotificationPage> list({int page = 1, int limit = 12}) async {
    final result = await _client.get<List<AppNotification>>(
      ApiEndpoints.notifications,
      // `unread` is intentionally omitted — the backend's coerce.boolean
      // would turn any value (including "false") into true.
      query: <String, Object?>{'page': page, 'limit': limit},
      decode: (json) =>
          ((json! as Map<String, dynamic>)['items'] as List<dynamic>? ??
                  const <dynamic>[])
              .map<AppNotification>(
                (item) =>
                    AppNotification.fromJson(item as Map<String, dynamic>),
              )
              .toList(),
    );
    final metaJson = result.meta ?? const <String, dynamic>{};
    return NotificationPage(
      items: result.data,
      meta: PaginationMeta.fromJson(metaJson),
      unread: (metaJson['unread'] as num?)?.toInt() ?? 0,
    );
  }

  Future<int> unreadCount() async {
    final result = await _client.get<Map<String, dynamic>>(
      ApiEndpoints.notificationsUnreadCount,
      decode: (json) => json! as Map<String, dynamic>,
    );
    return (result.data['count'] as num?)?.toInt() ?? 0;
  }

  Future<void> readAll() async {
    await _client.post<dynamic>(
      ApiEndpoints.notificationsReadAll,
      decode: (json) => json,
    );
  }

  Future<void> markRead(String id) async {
    await _client.post<dynamic>(
      ApiEndpoints.notificationRead(id),
      decode: (json) => json,
    );
  }
}
