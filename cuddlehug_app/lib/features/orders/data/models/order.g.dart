// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OrderItem _$OrderItemFromJson(Map<String, dynamic> json) => OrderItem(
  id: json['id'] as String,
  productId: json['productId'] as String,
  variantId: json['variantId'] as String,
  productName: json['productName'] as String,
  productSlug: json['productSlug'] as String,
  variantLabel: json['variantLabel'] as String,
  sku: json['sku'] as String,
  unitPrice: json['unitPrice'] as String,
  mrp: json['mrp'] as String,
  quantity: (json['quantity'] as num).toInt(),
  lineTotal: json['lineTotal'] as String,
  imageUrl: json['imageUrl'] as String?,
);

Map<String, dynamic> _$OrderItemToJson(OrderItem instance) => <String, dynamic>{
  'id': instance.id,
  'productId': instance.productId,
  'variantId': instance.variantId,
  'productName': instance.productName,
  'productSlug': instance.productSlug,
  'variantLabel': instance.variantLabel,
  'sku': instance.sku,
  'imageUrl': instance.imageUrl,
  'unitPrice': instance.unitPrice,
  'mrp': instance.mrp,
  'quantity': instance.quantity,
  'lineTotal': instance.lineTotal,
};

OrderHistoryEntry _$OrderHistoryEntryFromJson(Map<String, dynamic> json) =>
    OrderHistoryEntry(
      id: json['id'] as String,
      status: json['status'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      note: json['note'] as String?,
    );

Map<String, dynamic> _$OrderHistoryEntryToJson(OrderHistoryEntry instance) =>
    <String, dynamic>{
      'id': instance.id,
      'status': instance.status,
      'note': instance.note,
      'createdAt': instance.createdAt.toIso8601String(),
    };

OrderPayment _$OrderPaymentFromJson(Map<String, dynamic> json) => OrderPayment(
  id: json['id'] as String,
  provider: json['provider'] as String,
  amount: json['amount'] as String,
  status: json['status'] as String,
  providerOrderId: json['providerOrderId'] as String?,
  providerPaymentId: json['providerPaymentId'] as String?,
  method: json['method'] as String?,
);

Map<String, dynamic> _$OrderPaymentToJson(OrderPayment instance) =>
    <String, dynamic>{
      'id': instance.id,
      'provider': instance.provider,
      'providerOrderId': instance.providerOrderId,
      'providerPaymentId': instance.providerPaymentId,
      'amount': instance.amount,
      'status': instance.status,
      'method': instance.method,
    };

OrderUser _$OrderUserFromJson(Map<String, dynamic> json) => OrderUser(
  id: json['id'] as String,
  firstName: json['firstName'] as String,
  lastName: json['lastName'] as String,
  email: json['email'] as String,
  phone: json['phone'] as String?,
);

Map<String, dynamic> _$OrderUserToJson(OrderUser instance) => <String, dynamic>{
  'id': instance.id,
  'firstName': instance.firstName,
  'lastName': instance.lastName,
  'email': instance.email,
  'phone': instance.phone,
};

Order _$OrderFromJson(Map<String, dynamic> json) => Order(
  id: json['id'] as String,
  orderNumber: json['orderNumber'] as String,
  status: json['status'] as String,
  paymentStatus: json['paymentStatus'] as String,
  paymentMethod: json['paymentMethod'] as String,
  subtotal: json['subtotal'] as String,
  discountAmount: json['discountAmount'] as String,
  shippingAmount: json['shippingAmount'] as String,
  taxAmount: json['taxAmount'] as String,
  totalAmount: json['totalAmount'] as String,
  placedAt: DateTime.parse(json['placedAt'] as String),
  createdAt: DateTime.parse(json['createdAt'] as String),
  updatedAt: DateTime.parse(json['updatedAt'] as String),
  user: OrderUser.fromJson(json['user'] as Map<String, dynamic>),
  couponCode: json['couponCode'] as String?,
  currency: json['currency'] as String? ?? 'INR',
  shippingAddress: json['shippingAddress'] == null
      ? null
      : Address.fromJson(json['shippingAddress'] as Map<String, dynamic>),
  billingAddress: json['billingAddress'] == null
      ? null
      : Address.fromJson(json['billingAddress'] as Map<String, dynamic>),
  trackingNumber: json['trackingNumber'] as String?,
  courierName: json['courierName'] as String?,
  estimatedDelivery: json['estimatedDelivery'] == null
      ? null
      : DateTime.parse(json['estimatedDelivery'] as String),
  cancelReason: json['cancelReason'] as String?,
  paidAt: json['paidAt'] == null
      ? null
      : DateTime.parse(json['paidAt'] as String),
  payment: json['payment'] == null
      ? null
      : OrderPayment.fromJson(json['payment'] as Map<String, dynamic>),
  items:
      (json['items'] as List<dynamic>?)
          ?.map((e) => OrderItem.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
  history:
      (json['history'] as List<dynamic>?)
          ?.map((e) => OrderHistoryEntry.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
);

Map<String, dynamic> _$OrderToJson(Order instance) => <String, dynamic>{
  'id': instance.id,
  'orderNumber': instance.orderNumber,
  'status': instance.status,
  'paymentStatus': instance.paymentStatus,
  'paymentMethod': instance.paymentMethod,
  'subtotal': instance.subtotal,
  'discountAmount': instance.discountAmount,
  'couponCode': instance.couponCode,
  'shippingAmount': instance.shippingAmount,
  'taxAmount': instance.taxAmount,
  'totalAmount': instance.totalAmount,
  'currency': instance.currency,
  'shippingAddress': instance.shippingAddress,
  'billingAddress': instance.billingAddress,
  'trackingNumber': instance.trackingNumber,
  'courierName': instance.courierName,
  'estimatedDelivery': instance.estimatedDelivery?.toIso8601String(),
  'cancelReason': instance.cancelReason,
  'placedAt': instance.placedAt.toIso8601String(),
  'paidAt': instance.paidAt?.toIso8601String(),
  'createdAt': instance.createdAt.toIso8601String(),
  'updatedAt': instance.updatedAt.toIso8601String(),
  'user': instance.user,
  'payment': instance.payment,
  'items': instance.items,
  'history': instance.history,
};

OrderStats _$OrderStatsFromJson(Map<String, dynamic> json) => OrderStats(
  totalOrders: (json['totalOrders'] as num?)?.toInt() ?? 0,
  pendingOrders: (json['pendingOrders'] as num?)?.toInt() ?? 0,
  deliveredOrders: (json['deliveredOrders'] as num?)?.toInt() ?? 0,
  cancelledOrders: (json['cancelledOrders'] as num?)?.toInt() ?? 0,
  totalSpend: json['totalSpend'] as String? ?? '0.00',
);

Map<String, dynamic> _$OrderStatsToJson(OrderStats instance) =>
    <String, dynamic>{
      'totalOrders': instance.totalOrders,
      'pendingOrders': instance.pendingOrders,
      'deliveredOrders': instance.deliveredOrders,
      'cancelledOrders': instance.cancelledOrders,
      'totalSpend': instance.totalSpend,
    };
