export type Role = "CUSTOMER" | "ADMIN";
export type UserStatus = "ACTIVE" | "BLOCKED";

export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: Role;
  avatarUrl: string | null;
  emailVerified: boolean;
  status: UserStatus;
  createdAt: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  sortOrder: number;
  productCount: number;
  childCount: number;
  status?: "ACTIVE" | "HIDDEN";
  parentId?: string | null;
};

export type ProductImage = { url: string; alt: string; isPrimary: boolean };

export type AdminProduct = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  categoryId: string;
  shortDescription: string | null;
  description: string;
  mrp: string;
  price: string;
  discountPercent: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  material: string | null;
  filling: string | null;
  weightGrams: number | null;
  careInstructions: string | null;
  ageRecommendation: string | null;
  tags: string[];
  isFeatured: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  soldCount: number;
  lowStockThreshold: number;
  ratingAverage: number;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string; slug: string };
  images: { id?: string; url: string; alt: string; position?: number; isPrimary: boolean }[];
  variants: {
    id?: string;
    size: ProductSize;
    color: ProductColor;
    sku: string;
    mrp: string;
    price: string;
    isActive: boolean;
    inventory?: { quantity: number; reserved: number; lowStockThreshold: number };
  }[];
};

export type ProductSize = "MINI" | "SMALL" | "MEDIUM" | "LARGE" | "GIANT";
export type ProductColor = "BROWN" | "PINK" | "WHITE" | "CREAM" | "RED";

export const PRODUCT_SIZES: ProductSize[] = ["MINI", "SMALL", "MEDIUM", "LARGE", "GIANT"];
export const PRODUCT_COLORS: ProductColor[] = ["BROWN", "PINK", "WHITE", "CREAM", "RED"];

export type Variant = {
  id: string;
  size: ProductSize;
  color: ProductColor;
  sku: string;
  price: string;
  mrp: string;
  available: number;
};

export type ProductCard = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  shortDescription: string | null;
  mrp: string;
  price: string;
  discountPercent: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  category: { id: string; name: string; slug: string };
  images: ProductImage[];
  image: string | null;
  ratingAverage: number;
  ratingCount: number;
  reviewCount: number;
  soldCount: number;
  isFeatured: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  inStock: boolean;
  available: number;
  lowStock: boolean;
  createdAt: string;
  variants: Variant[];
};

export type ProductDetail = ProductCard & {
  description: string;
  material: string | null;
  filling: string | null;
  weightGrams: number | null;
  careInstructions: string | null;
  ageRecommendation: string | null;
  tags: string[];
  lowStockThreshold: number;
  variants: (Variant & { inventory?: { quantity: number; reserved: number; lowStockThreshold: number } })[];
};

export type CartLine = {
  id: string;
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantLabel: string;
  imageUrl: string | null;
  unitPrice: string;
  mrp: string;
  quantity: number;
  maxQuantity: number;
  inStock: boolean;
  available: number;
  lineTotal: string;
  savings: string;
};

export type CartSummary = {
  subtotal: string;
  mrpTotal: string;
  productSavings: string;
  couponDiscount: string;
  discountedSubtotal: string;
  shipping: string;
  tax: string;
  total: string;
  freeShippingUnlocked: boolean;
};

export type Cart = {
  id: string;
  items: CartLine[];
  summary: CartSummary;
  coupon: { code: string; type: string; value: string; discount: string } | null;
};

export type Address = {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  isDefault: boolean;
};

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "PACKED"
  | "SHIPPED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED"
  | "REFUNDED";

export type PaymentMethod = "RAZORPAY" | "COD";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export type OrderItem = {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  productSlug: string;
  variantLabel: string;
  imageUrl: string | null;
  unitPrice: string;
  mrp: string;
  quantity: number;
  lineTotal: string;
};

export type Order = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  subtotal: string;
  discountAmount: string;
  shippingAmount: string;
  taxAmount: string;
  totalAmount: string;
  couponCode: string | null;
  shippingAddress: Address | Record<string, string>;
  estimatedDelivery: string | null;
  trackingNumber: string | null;
  courierName: string | null;
  cancelReason: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  history?: { id: string; status: OrderStatus; note: string | null; createdAt: string }[];
  payment?: { status: PaymentStatus; amount: string; provider: string; paidAt: string | null }[];
  user?: { id: string; firstName: string; lastName: string; email: string; phone: string | null };
};

export type Review = {
  id: string;
  productId?: string;
  rating: number;
  title: string;
  comment: string;
  imageUrl?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  user?: { id: string; name: string; avatarUrl?: string | null } | null;
  product?: { id: string; name: string; slug: string } | null;
};

export type WishlistItem = {
  id: string;
  createdAt: string;
  product: {
    id: string;
    name: string;
    slug: string;
    image: string | null;
    price: string;
    mrp: string;
    discountPercent: number;
    ratingAverage: number;
    ratingCount: number;
    inStock: boolean;
    variantId: string | null;
  };
};

export type Coupon = {
  id: string;
  code: string;
  description: string | null;
  type: "PERCENTAGE" | "FIXED";
  value: string;
  maxDiscount: string | null;
  minOrderAmount: string | null;
  startsAt: string;
  endsAt: string;
  usageLimit: number | null;
  usedCount: number;
  perUserLimit: number;
  active: boolean;
};

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

export type Paginated<T> = {
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number; [key: string]: unknown };
};

export type StoreSettings = {
  "store.name": string;
  "store.tagline": string;
  "store.status": "open" | "closed";
  "store.currency": string;
  "tax.enabled": boolean;
  "tax.rate": number;
  "shipping.fee": number;
  "shipping.freeThreshold": number;
  "shipping.codEnabled": boolean;
  "contact.email": string;
  "contact.phone": string;
  "contact.address": string;
  "social.instagram": string;
  "social.facebook": string;
  "social.twitter": string;
  "social.youtube": string;
  "payment.razorpayEnabled": boolean;
};

export type HomeContent = {
  settings: StoreSettings;
  categories: Category[];
  featured: ProductCard[];
  bestSellers: ProductCard[];
  newArrivals: ProductCard[];
  hero: { image: string; alt: string }[];
};

export type AdminDashboard = {
  cards: {
    totalSales: string;
    totalOrders: number;
    totalProducts: number;
    totalCustomers: number;
    pendingOrders: number;
    lowStock: number;
    revenue: string;
    refunds: string;
    paidOrders: number;
    refundedOrders: number;
    newCustomers: number;
    pendingReviews: number;
  };
  chart: { date: string; revenue: number; orders: number }[];
  statusBreakdown: { status: OrderStatus; count: number }[];
  topProducts: {
    productId: string;
    name: string;
    slug: string;
    image: string | null;
    quantity: number;
    revenue: string;
    orders: number;
  }[];
  recentOrders: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    totalAmount: string;
    createdAt: string;
    customer: string;
    email: string;
    itemCount: number;
    items: string[];
  }[];
  lowStock: {
    variantId: string;
    sku: string;
    size: string;
    color: string;
    quantity: number;
    reserved: number;
    available: number;
    lowStockThreshold: number;
    product: { id: string; name: string; slug: string };
  }[];
  range: { from: string; to: string };
};

export type InventoryAdminRow = {
  inventoryId: string;
  variantId: string;
  sku: string;
  size: string;
  color: string;
  quantity: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  updatedAt: string;
  lastMovement: { type: string; delta: number; at: string } | null;
  product: { id: string; name: string; slug: string; status: string };
};

export type InventoryTransaction = {
  id: string;
  type: string;
  quantity: number;
  delta: number;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
  variant: { id: string; sku: string; size: string; color: string; product: { name: string; slug: string } };
  actor: string | null;
};

export type CustomerRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: UserStatus;
  createdAt: string;
  orderCount: number;
  reviewCount: number;
  totalSpend: string;
  lastOrderAt: string | null;
};

export type CouponAdmin = Coupon & {
  description: string | null;
  restrictions: { products: number; variants: number };
};

export type AdminReview = Review;

export type SalesReport = {
  series: { date: string; orders: number; revenue: number; tax: number; shipping: number; discounts: number }[];
  totals: {
    orders: number;
    revenue: string;
    tax: string;
    shipping: string;
    discounts: string;
    averageOrderValue: string;
  };
};

export type OrdersReport = {
  total: number;
  byStatus: { status: string; count: number; amount: string }[];
  byPaymentStatus: { status: string; count: number; amount: string }[];
  byPaymentMethod: { method: string; count: number; amount: string }[];
};

export type ProductReportRow = {
  productId: string;
  name: string;
  slug: string;
  sku: string;
  category: { id: string; name: string; slug: string };
  image: string | null;
  price: string;
  mrp: string;
  unitsSold: number;
  revenue: string;
  orderLines: number;
  rating: number;
  ratingCount: number;
  status: string;
};

export type CustomerReportRow = {
  userId: string;
  name: string;
  email: string;
  status: UserStatus;
  orders: number;
  totalSpend: string;
  lastOrderAt: string | null;
};

export type CouponReportRow = {
  id: string;
  code: string;
  type: string;
  value: string;
  active: boolean;
  startsAt: string;
  endsAt: string;
  usageLimit: number | null;
  usedCount: number;
  perUserLimit: number;
  minOrderAmount: string;
  maxDiscount: string | null;
  totalUsages: number;
  discountGiven: string;
};

export type AuditLog = {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  meta: unknown;
  ip: string | null;
  createdAt: string;
  actor: string | null;
};
