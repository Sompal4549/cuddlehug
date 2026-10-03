import 'package:cuddlehug_app/app_providers.dart';
import 'package:cuddlehug_app/core/network/api_endpoints.dart';
import 'package:cuddlehug_app/core/network/api_exception.dart' show ApiException;
import 'package:cuddlehug_app/core/network/dio_client.dart';
import 'package:cuddlehug_app/features/checkout/data/models/payment_intent.dart';
import 'package:cuddlehug_app/features/orders/data/models/order.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Checkout writes: order creation (with `Idempotency-Key`), payment
/// intent, signature verification and the dev-mode completion path.
/// All payment routes require auth; errors surface as [ApiException] with
/// the backend's `code` (`CART_EMPTY`, `OUT_OF_STOCK`, `INVALID_STATE`…).
final checkoutRepositoryProvider = Provider<CheckoutRepository>(
  (ref) => CheckoutRepository(ref.watch(dioClientProvider)),
);

class CheckoutRepository {
  new(this._client);

  final DioClient _client;

  Future<Order> createOrder({
    required String addressId,
    required String paymentMethod,
    String? couponCode,
    String? idempotencyKey,
  }) async {
    final result = await _client.post<Order>(
      ApiEndpoints.orders,
      decode: (json) => Order.fromJson(json! as Map<String, dynamic>),
      body: <String, Object?>{
        'addressId': addressId,
        'paymentMethod': paymentMethod,
        if (couponCode != null && couponCode.isNotEmpty)
          'couponCode': couponCode,
      },
      headers: idempotencyKey == null
          ? null
          : <String, dynamic>{'Idempotency-Key': idempotencyKey},
    );
    return result.data;
  }

  Future<PaymentIntent> createPaymentIntent(String orderId) async {
    final result = await _client.post<PaymentIntent>(
      ApiEndpoints.paymentsCreateOrder,
      decode: (json) => PaymentIntent.fromJson(json! as Map<String, dynamic>),
      body: <String, Object?>{'orderId': orderId},
    );
    return result.data;
  }

  Future<Order> verifyPayment(PaymentVerifyPayload payload) async {
    final result = await _client.post<Order>(
      ApiEndpoints.paymentsVerify,
      decode: (json) => Order.fromJson(json! as Map<String, dynamic>),
      body: payload.toJson(),
    );
    return result.data;
  }

  Future<Order> devComplete(String orderId) async {
    final result = await _client.post<Order>(
      ApiEndpoints.paymentsDevComplete,
      decode: (json) => Order.fromJson(json! as Map<String, dynamic>),
      body: <String, Object?>{'orderId': orderId},
    );
    return result.data;
  }

  Future<PaymentStatusInfo> paymentStatus(String orderId) async {
    final result = await _client.get<PaymentStatusInfo>(
      ApiEndpoints.paymentsStatus,
      query: <String, Object?>{'orderId': orderId},
      decode: (json) => PaymentStatusInfo.fromJson(json! as Map<String, dynamic>),
    );
    return result.data;
  }
}
