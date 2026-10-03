import 'package:cuddlehug_app/core/network/paged.dart';
import 'package:flutter/foundation.dart';
import 'package:json_annotation/json_annotation.dart';

part 'app_notification.g.dart';

/// In-app push inbox row (`GET /api/notifications`). Read state is the
/// boolean [read] — the backend has no read timestamp.
@immutable
@JsonSerializable()
class AppNotification {
  const new({
    required this.id,
    required this.type,
    required this.title,
    required this.createdAt, this.body,
    this.data,
    this.read = false,
  });

  factory fromJson(Map<String, dynamic> json) => _$AppNotificationFromJson(json);

  final String id;
  final String type;
  final String title;
  final String? body;
  final Object? data;
  final bool read;
  final DateTime createdAt;
}

/// One page of notifications plus the global unread counter, which rides
/// in `meta.unread` beside `data`.
@immutable
class NotificationPage {
  const new({
    required this.items,
    required this.meta,
    required this.unread,
  });

  final List<AppNotification> items;
  final PaginationMeta meta;
  final int unread;
}
