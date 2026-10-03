import 'package:cuddlehug_app/core/utils/money.dart';
import 'package:cuddlehug_app/features/account/data/models/address.dart';
import 'package:flutter/foundation.dart';
import 'package:json_annotation/json_annotation.dart';

part 'order.g.dart';

/// One line on an order (snapshot taken at purchase time).
@immutable
@JsonSerializable()
class OrderItem {
  const new({
    required this.id,
    required this.productId,
    required this.variantId,
    required this.productName,
    required this.productSlug,
    required this.variantLabel,
    required this.sku,
    required this.unitPrice, required this.mrp, required this.quantity, required this.lineTotal, this.imageUrl,
  });

  factory fromJson(Map<String, dynamic> json) =>
      _$OrderItemFromJson(json);

  final String id;
  final String productId;
  final String variantId;
  final String productName;
  final String productSlug;
  final String variantLabel;
  final String sku;
  final String? imageUrl;
  final String unitPrice;
  final String mrp;
  final int quantity;
  final String lineTotal;

  Money get lineTotalMoney => Money.parse(lineTotal);
}

/// Status timeline entry (`createdAt` ascending).
@immutable
@JsonSerializable()
class OrderHistoryEntry {
  const new({
    required this.id,
    required this.status,
    required this.createdAt, this.note,
  });

  factory fromJson(Map<String, dynamic> json) =>
      _$OrderHistoryEntryFromJson(json);

  final String id;
  final String status;
  final String? note;
  final DateTime createdAt;
}

/// Payment record snapshot on the order.
@immutable
@JsonSerializable()
class OrderPayment {
  const new({
    required this.id,
    required this.provider,
    required this.amount, required this.status, this.providerOrderId,
    this.providerPaymentId,
    this.method,
  });

  factory fromJson(Map<String, dynamic> json) =>
      _$OrderPaymentFromJson(json);

  final String id;
  final String provider;
  final String? providerOrderId;
  final String? providerPaymentId;
  final String amount;
  final String status;
  final String? method;
}

/// Order customer reference.
@immutable
@JsonSerializable()
class OrderUser {
  const new({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.email,
    this.phone,
  });

  factory fromJson(Map<String, dynamic> json) =>
      _$OrderUserFromJson(json);

  final String id;
  final String firstName;
  final String lastName;
  final String email;
  final String? phone;
}

/// Full `OrderDto` from `GET /api/orders[/:id]`.
@immutable
@JsonSerializable()
class Order {
  const new({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.paymentStatus,
    required this.paymentMethod,
    required this.subtotal,
    required this.discountAmount,
    required this.shippingAmount, required this.taxAmount, required this.totalAmount, required this.placedAt, required this.createdAt, required this.updatedAt, required this.user, this.couponCode,
    this.currency = 'INR',
    this.shippingAddress,
    this.billingAddress,
    this.trackingNumber,
    this.courierName,
    this.estimatedDelivery,
    this.cancelReason,
    this.paidAt,
    this.payment,
    this.items = const [],
    this.history = const [],
  });

  factory fromJson(Map<String, dynamic> json) => _$OrderFromJson(json);

  final String id;
  final String orderNumber;
  final String status;
  final String paymentStatus;
  final String paymentMethod;
  final String subtotal;
  final String discountAmount;
  final String? couponCode;
  final String shippingAmount;
  final String taxAmount;
  final String totalAmount;
  final String currency;
  final Address? shippingAddress;
  final Address? billingAddress;
  final String? trackingNumber;
  final String? courierName;
  final DateTime? estimatedDelivery;
  final String? cancelReason;
  final DateTime placedAt;
  final DateTime? paidAt;
  final DateTime createdAt;
  final DateTime updatedAt;
  final OrderUser user;
  final OrderPayment? payment;
  final List<OrderItem> items;
  final List<OrderHistoryEntry> history;

  Money get totalMoney => Money.parse(totalAmount);
  Money get subtotalMoney => Money.parse(subtotal);
  Money get discountMoney => Money.parse(discountAmount);
  Money get shippingMoney => Money.parse(shippingAmount);
  Money get taxMoney => Money.parse(taxAmount);

  bool get isCancelled =>
      status == 'CANCELLED' || status == 'RETURNED' || status == 'REFUNDED';
  bool get isDelivered => status == 'DELIVERED';
}

/// `GET /api/orders/stats` payload.
@immutable
@JsonSerializable()
class OrderStats {
  const new({
    this.totalOrders = 0,
    this.pendingOrders = 0,
    this.deliveredOrders = 0,
    this.cancelledOrders = 0,
    this.totalSpend = '0.00',
  });

  factory fromJson(Map<String, dynamic> json) =>
      _$OrderStatsFromJson(json);

  final int totalOrders;
  final int pendingOrders;
  final int deliveredOrders;
  final int cancelledOrders;
  final String totalSpend;

  Money get totalSpendMoney => Money.parse(totalSpend);
}
