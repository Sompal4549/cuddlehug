/// Every backend path in one place (plan §4.3).
///
/// Paths are relative to `AppConfig.apiBaseUrl` (host root, no `/api`
/// suffix) — the backend mounts everything under `/api`.
abstract final class ApiEndpoints {
  // Auth
  static const register = '/api/auth/register';
  static const login = '/api/auth/login';
  static const refresh = '/api/auth/refresh';
  static const logout = '/api/auth/logout';
  static const forgotPassword = '/api/auth/forgot-password';
  static const resetPassword = '/api/auth/reset-password';
  static const me = '/api/auth/me';

  // Catalog
  static const products = '/api/products';
  static const productsFeatured = '/api/products/featured';
  static const productsBestSellers = '/api/products/best-sellers';
  static const productsNewArrivals = '/api/products/new-arrivals';
  static String productBySlug(String slug) => '/api/products/$slug';
  static String relatedProducts(String slug) => '/api/products/$slug/related';
  static const categories = '/api/categories';
  static String categoryBySlug(String slug) => '/api/categories/$slug';
  static String productReviews(String productId) =>
      '/api/reviews/product/$productId';
  static const reviewsMine = '/api/reviews/mine';
  static const reviews = '/api/reviews';

  // Cart (guest via ch_sid cookie)
  static const cart = '/api/cart';
  static const cartItems = '/api/cart/items';
  static const cartCoupon = '/api/cart/coupon';

  // Wishlist
  static const wishlist = '/api/wishlist';
  static String wishlistCheck(String productId) =>
      '/api/wishlist/$productId/check';

  // Orders & checkout
  static const orders = '/api/orders';
  static const ordersStats = '/api/orders/stats';
  static String orderById(String id) => '/api/orders/$id';
  static const paymentsStatus = '/api/payments/status';
  static const paymentsCreateOrder = '/api/payments/create-order';
  static const paymentsVerify = '/api/payments/verify';
  static const paymentsDevComplete = '/api/payments/dev-complete';

  // Addresses
  static const addresses = '/api/addresses';

  // Account
  static const profile = '/api/profile';
  static const changePassword = '/api/profile/password';
  static const notifications = '/api/notifications';
  static const notificationsUnreadCount = '/api/notifications/unread-count';
  static const notificationsReadAll = '/api/notifications/read-all';
  static String notificationRead(String id) => '/api/notifications/$id/read';
  static const devices = '/api/devices';
  static const deviceRegister = '/api/devices/register';
  static const deviceUnregister = '/api/devices/unregister';

  // Static
  static const settings = '/api/settings';
  static const homeContent = '/api/content/home';
  static const health = '/api/health';
}
