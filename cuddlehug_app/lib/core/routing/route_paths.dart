/// All navigable locations in one place.
abstract final class RoutePaths {
  static const splash = '/splash';

  // Bottom-nav branches
  static const home = '/';
  static const shop = '/shop';
  static const cart = '/cart';
  static const account = '/account';

  // Catalog
  static const search = '/search';
  static const categories = '/categories';
  static const productDetailPath = '/product/:slug';
  static const categoryPath = '/category/:slug';
  static String productDetail(String slug) => '/product/$slug';
  static String categoryLanding(String slug) => '/category/$slug';

  // Auth
  static const login = '/login';
  static const register = '/register';
  static const forgotPassword = '/forgot-password';
  static const resetPassword = '/reset-password';

  // Commerce
  static const checkout = '/checkout';
  static const orders = '/orders';
  static String orderDetail(String id) => '/orders/$id';
  static const orderConfirmation = '/orders/confirmation';
  static const wishlist = '/wishlist';
  static const addresses = '/addresses';
  static const addressNew = '/addresses/new';
  static String addressEdit(String id) => '/addresses/$id';

  // Account
  static const notifications = '/notifications';
  static const profile = '/profile';
  static const profilePassword = '/profile/password';
  static const settings = '/settings';
}
