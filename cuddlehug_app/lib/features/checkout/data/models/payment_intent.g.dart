// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'payment_intent.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PaymentIntent _$PaymentIntentFromJson(Map<String, dynamic> json) =>
    PaymentIntent(
      devMode: json['devMode'] as bool,
      orderId: json['orderId'] as String,
      orderNumber: json['orderNumber'] as String,
      amount: (json['amount'] as num).toInt(),
      amountDisplay: json['amountDisplay'] as String,
      currency: json['currency'] as String,
      keyId: json['keyId'] as String?,
      razorpayOrderId: json['razorpayOrderId'] as String?,
    );

Map<String, dynamic> _$PaymentIntentToJson(PaymentIntent instance) =>
    <String, dynamic>{
      'devMode': instance.devMode,
      'keyId': instance.keyId,
      'razorpayOrderId': instance.razorpayOrderId,
      'orderId': instance.orderId,
      'orderNumber': instance.orderNumber,
      'amount': instance.amount,
      'amountDisplay': instance.amountDisplay,
      'currency': instance.currency,
    };

PaymentVerifyPayload _$PaymentVerifyPayloadFromJson(
  Map<String, dynamic> json,
) => PaymentVerifyPayload(
  razorpayOrderId: json['razorpay_order_id'] as String,
  razorpayPaymentId: json['razorpay_payment_id'] as String,
  razorpaySignature: json['razorpay_signature'] as String,
);

Map<String, dynamic> _$PaymentVerifyPayloadToJson(
  PaymentVerifyPayload instance,
) => <String, dynamic>{
  'razorpay_order_id': instance.razorpayOrderId,
  'razorpay_payment_id': instance.razorpayPaymentId,
  'razorpay_signature': instance.razorpaySignature,
};

PaymentStatusInfo _$PaymentStatusInfoFromJson(Map<String, dynamic> json) =>
    PaymentStatusInfo(
      orderNumber: json['orderNumber'] as String,
      paymentStatus: json['paymentStatus'] as String,
      status: json['status'] as String,
    );

Map<String, dynamic> _$PaymentStatusInfoToJson(PaymentStatusInfo instance) =>
    <String, dynamic>{
      'orderNumber': instance.orderNumber,
      'paymentStatus': instance.paymentStatus,
      'status': instance.status,
    };
