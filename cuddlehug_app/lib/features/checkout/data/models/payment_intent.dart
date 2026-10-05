import 'package:flutter/foundation.dart';
import 'package:json_annotation/json_annotation.dart';

part 'payment_intent.g.dart';

/// `POST /api/payments/create-order` response. In dev mode (Razorpay keys
/// absent, non-production) the payment step is simulated via
/// `dev-complete`; otherwise [keyId]/[razorpayOrderId] feed the Razorpay
/// checkout sheet.
@immutable
@JsonSerializable()
class PaymentIntent {
  const new({
    required this.devMode,
    required this.orderId,
    required this.orderNumber,
    required this.amount,
    required this.amountDisplay,
    required this.currency,
    this.keyId,
    this.razorpayOrderId,
  });

  factory fromJson(Map<String, dynamic> json) => _$PaymentIntentFromJson(json);

  final bool devMode;
  final String? keyId;
  final String? razorpayOrderId;
  final String orderId;
  final String orderNumber;

  /// Minor units (paise) — what the Razorpay sheet expects.
  final int amount;
  final String amountDisplay;
  final String currency;
}

/// Razorpay handler payload passed straight to `POST /api/payments/verify`
/// (snake_case field names match the backend schema).
@immutable
@JsonSerializable()
class PaymentVerifyPayload {
  const new({
    required this.razorpayOrderId,
    required this.razorpayPaymentId,
    required this.razorpaySignature,
  });

  factory fromJson(Map<String, dynamic> json) =>
      _$PaymentVerifyPayloadFromJson(json);

  @JsonKey(name: 'razorpay_order_id')
  final String razorpayOrderId;

  @JsonKey(name: 'razorpay_payment_id')
  final String razorpayPaymentId;

  @JsonKey(name: 'razorpay_signature')
  final String razorpaySignature;

  Map<String, Object?> toJson() => _$PaymentVerifyPayloadToJson(this);
}

/// `GET /api/payments/status?orderId=` response.
@immutable
@JsonSerializable()
class PaymentStatusInfo {
  const new({
    required this.orderNumber,
    required this.paymentStatus,
    required this.status,
  });

  factory fromJson(Map<String, dynamic> json) =>
      _$PaymentStatusInfoFromJson(json);

  final String orderNumber;
  final String paymentStatus;
  final String status;
}
