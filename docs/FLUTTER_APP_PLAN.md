# CuddleHug Flutter App — Production Technical Plan

**Status:** Final (Flutter selected — no framework debate)
**Scope:** Customer mobile application for Android phone, iPhone, Android tablet, iPad
**Constraint:** Existing backend + web frontend keep working; app consumes the existing REST API with minimal, justified backend changes.

---

# PART 0 — PHASE 1: VERIFIED PROJECT REVIEW (no code was modified)

All assumptions below were verified against actual code (file references from `backend/` and `frontend/`).

## 0.1 What the description got right

- Express 5 + TS + Prisma 6 + PostgreSQL + Zod + JWT + rate limiting + Cloudinary/Resend/Razorpay — all confirmed.
- Feature set (auth, catalog, cart, guest cart + merge, orders, payments, coupons, reviews, notifications, addresses, admin) — all present and functional.
- One unified response envelope: `{success:true,data,meta?}` on success, `{success:false,message,code,details?}` on error — every controller uses the same helpers (`src/utils/response.ts`, `src/middleware/errorHandler.ts:76-81`).
- Access token in JSON body, `Authorization: Bearer` for all authenticated endpoints; refresh rotation + reuse detection (family revocation) works (`src/services/auth.service.ts:136-157`).
- Money is serialized as **2-decimal strings** (`"1728.64"`) in DTOs; dates are ISO-8601 UTC strings.
- Server is the source of truth for all pricing (`computePricing` — integer-paise math).

## 0.2 Critical findings that change the mobile design

| # | Finding | Verified at | Impact on Flutter |
|---|---|---|---|
| 1 | **Refresh token is cookie-only** — `POST /api/auth/refresh` reads only `req.cookies["ch_refresh"]`; no body/header alternative | `auth.controller.ts:61` | Flutter must persist and replay the raw cookie (proven to work — `scripts/smoke.mjs` replays `Cookie:` manually), or we add a body fallback |
| 2 | **Guest cart is cookie-only** — `ch_sid` is minted per request if absent; no header fallback | `middleware/context.ts:18-35` | Flutter must persist `ch_sid` across restarts or the guest cart resets on every call |
| 3 | **No Razorpay webhook, no cron, no reconciliation** — `verifyRazorpayWebhookSignature` exists but has zero call sites | `utils/razorpay.ts:85-89` | If app is killed after checkout and before `/payments/verify`, order stays `PENDING` forever with stock reserved. **Backend change required** (Phase 7) |
| 4 | **No push/FCM/device-token code anywhere**; `Notification` model is DB rows only | grep = 0 hits | Push requires new `DeviceToken` model + endpoints + FCM sender (Phase 9) |
| 5 | **Image URLs are ambiguous relative paths**: seed stores `/images/*` (files live in `frontend/public/images/`), local uploads return `/uploads/*` (API origin), Cloudinary returns absolute | `prisma/seed.ts:6`, `upload.service.ts:71` | Flutter needs an image-URL resolver mapping `/images/*` → web asset base, `/uploads/*` → API base |
| 6 | **No image transformations anywhere** — full-size originals served | `upload.service.ts:54-63` | Mobile must request Cloudinary transforms when available and use `cacheWidth` locally |
| 7 | **Error `details` stripped in production** (`errorHandler.ts:80`) — e.g. `OUT_OF_STOCK.details.available` vanishes | `errorHandler.ts:78-80` | Do not build UI that depends on `details` in prod (RECOMMENDED backend change) |
| 8 | **Cart `items` vs `summary` inconsistency** — summary prices lines that `items` filters out (archived/inactive) | `cart.service.ts:110` vs `:138-143` | Cart total may not match visible lines (RECOMMENDED backend fix) |
| 9 | `POST /api/orders` has **no idempotency key** — protection is only cart-empty-after-order side effect | `order.service.ts:145` | Client must single-flight order creation (RECOMMENDED server key too) |
| 10 | `GET /api/payments/status` **without `orderId`** returns an arbitrary user order | `payment.service.ts:269-273` | Always send `orderId`; validate server-side |
| 11 | **Amount type drift**: money = string everywhere, except `payments/create-order.amount` = integer paise | `payment.service.ts:114` | DTOs must model this explicitly |
| 12 | Razorpay backend **never calls capture API** — relies on dashboard auto-capture; `Payment.method` hard-coded `"card"` | `payment.service.ts:195` | Webhook (`payment.captured`) is the correct fix |
| 13 | `attachUser` never rejects: expired Bearer ⇒ anonymous ⇒ generic `401 UNAUTHORIZED "You must be signed in"` | `middleware/auth.ts:7-18` | Refresh **proactively on a timer** (15-min access token), don't wait for 401 |
| 14 | Rate limits: login/register **30/15min**, forgot/reset **10/h**, global 300/15min; 429 body = `{success:false,code:"RATE_LIMITED"}`, no `Retry-After` (use `RateLimit-Reset`) | `middleware/rateLimit.ts` | Backoff UI required |
| 15 | `details` aside: `meta` = `{page,limit,total,totalPages}` — **no `hasMore`**; some lists return **no meta** | `utils/pagination.ts:14-21` | Pagination parser must handle absent `meta` |
| 16 | Limit caps differ: `/products` limit ≤ 48, others ≤ 100; defaults = 12 | `validators/common.ts:31`, `catalog.validator.ts:37-38` | Encode per-endpoint |
| 17 | CORS allows only web origins — irrelevant to native app (no CORS) | `app.ts:29-35` | None |
| 18 | Store settings are a flat key map (`shipping.codEnabled`, `shipping.fee=79`, `shipping.freeThreshold=1499`, `tax.rate=18`, `payment.razorpayEnabled`, `store.status`) | `settings.service.ts:25-44` | Checkout must read settings, not hardcode |
| 19 | Design: light-only, Inter, warm palette `#fffaf6 / #e0674f / #2c1d16`, radii md 0.6rem / lg 0.9rem / xl 1.4rem, shadows soft/lift | `frontend/src/app/globals.css` | Recreate natively (Phase 16) |
| 20 | Web has **no bottom nav**; top sticky header only; product grid `2 → md:3 → lg:4` cols | `navbar.tsx`, `shop-view.tsx` | Mobile app introduces bottom nav (platform convention) while keeping brand look |

## 0.3 Verified API surface used by the customer app

```
AUTH        POST /api/auth/register|login|refresh|logout|forgot-password|reset-password
            GET  /api/auth/me   PATCH /api/auth/profile|password
CATALOG     GET  /api/products (search,category,minPrice,maxPrice,size,color,rating,
                    availability,sort,page,limit,featured,bestSeller,newArrival)
            GET  /api/products/featured|best-sellers|new-arrivals|:slug|:slug/related
            GET  /api/categories[/:slug]   GET /api/reviews/product/:id
COMMERCE    GET|POST|PATCH|DELETE /api/cart[/items[/:itemId]]  POST|DELETE /api/cart/coupon
            GET|POST|DELETE /api/wishlist[...]  GET /api/wishlist/:pid/check
            GET|POST /api/orders  GET /api/orders/:id  GET /api/orders/stats
            POST /api/payments/create-order|verify|dev-complete  GET /api/payments/status
ACCOUNT     /api/addresses[...]  /api/notifications[...]  /api/profile
            GET /api/settings  GET /api/content/home  GET /api/health
REVIEWS     POST /api/reviews  GET /api/reviews/mine  PATCH /api/reviews/:id (moderation = web)
```

Admin APIs are **out of scope** for v1 (Phase 13).

---

# PART 1 — PHASE 2: FLUTTER ARCHITECTURE

## 2.1 Technology baseline

| Concern | Choice | Why |
|---|---|---|
| SDK | Flutter ≥ 3.24, Dart ≥ 3.5, Material 3 | Stable, wide tablet support |
| Min versions | Android API 24 (7.0), iOS 13 | Covers ~97% devices |
| State mgmt | **Riverpod 2** (see Phase 3) | |
| Navigation | **go_router 14+** | Declarative, deep links, redirect guards |
| HTTP | **Dio 5** | Interceptors, cancellation, timeouts |
| JSON | **json_serializable + build_runner** | 50+ DTOs — manual fromJson is a bug factory |
| Secure storage | **flutter_secure_storage** | Keychain / EncryptedSharedPreferences |
| Local prefs | **shared_preferences** (non-sensitive only) | flags, seen-onboarding, last filters |
| Images | **cached_network_image** + `flutter_cache_manager` | memory/disk caching |
| Push | **firebase_messaging** + flutter_local_notifications | Phase 9 |
| Payments | **razorpay_flutter** | Native checkout SDK |
| Connectivity | **connectivity_plus** | offline banners/retry triggers |
| Forms | Flutter `Form` + `GlobalKey<FormState>` + per-field validators | Forms here are simple; no heavy form library |
| Lint | `very_good_analysis` (or `flutter_lints` strict) | |
| Env config | `--dart-define-from-file=config/{dev,staging,prod}.json` | Phase 20 |

**Not used (deliberately):** GetX (magic DI, untestable), retrofit (adds codegen without much gain over Dio+DTO), isar/hive offline DB (not needed in v1 — see Phase 11), drift/sqflite (no local relational data).

## 2.2 Folder structure (feature-first, improved over the suggested example)

```
cuddlehug_app/
├── config/                      # dev.json, staging.json, prod.json (dart-define files)
├── firebase_options/            # per-env Firebase options (public keys only)
├── lib/
│   ├── main.dart                # bootstrap: env → Firebase → DI → runApp
│   ├── app.dart                 # MaterialApp.router + providers
│   ├── core/
│   │   ├── config/              # app_config.dart (typed env access)
│   │   ├── theme/               # colors.dart, typography.dart, spacing.dart, app_theme.dart
│   │   ├── routing/             # app_router.dart, route_paths.dart, deep_link_handler.dart
│   │   ├── network/             # dio_client.dart, api_endpoints.dart, interceptors/
│   │   │                        #   auth_interceptor.dart, cookie_header_interceptor.dart,
│   │   │                        #   retry_interceptor.dart, logging_interceptor.dart (debug only)
│   │   │                        # envelope.dart (ApiEnvelope, ApiFailure), api_exception.dart
│   │   ├── storage/             # secure_store.dart (tokens, ch_sid), prefs_store.dart,
│   │   │                        # pending_payment_store.dart
│   │   ├── utils/               # image_url_resolver.dart, formatters.dart (₹/dates/status),
│   │   │                        # debouncer.dart, connectivity_service.dart
│   │   └── widgets/             # app_button, app_text_field, app_badge, price_text, stars,
│   │                            # quantity_stepper, skeleton (shimmer), empty_state, error_view,
│   │                            # offline_banner, app_bottom_sheet, app_dialog, section_header
│   └── features/
│       ├── splash/              # splash + session bootstrap
│       ├── auth/                # login, register, forgot/reset password
│       ├── home/                # hero, perks, categories strip, product tabs, promo
│       ├── catalog/             # shop list + filters + product detail + reviews display
│       ├── categories/          # category grid + category landing
│       ├── search/              # search screen (debonced, recent searches local)
│       ├── cart/                # cart lines, coupon, summary
│       ├── wishlist/
│       ├── checkout/            # address picker, payment method, review, place order
│       ├── payments/            # razorpay session, payment status/resume logic
│       ├── orders/              # my orders, order detail, order confirmation
│       ├── reviews/             # my reviews, write review
│       ├── addresses/           # address book CRUD
│       ├── notifications/       # in-app notification center (+ push handlers)
│       ├── profile/             # profile edit, change password, logout, stats
│       └── support/             # static content pages (about, faq, shipping, returns...)
│
├── test/                        # unit + widget tests (mirrors lib/)
└── integration_test/            # full flows against local backend
```

**Per-feature internal convention** (3 layers — no over-ceremony):

```
features/cart/
├── data/
│   ├── models/          # CartDto, CartItemDto, CartSummaryDto (json_serializable)
│   └── cart_repository.dart     # Dio calls → domain models
├── application/
│   ├── cart_controller.dart     # AsyncNotifier/Notifier (Riverpod)
│   └── cart_providers.dart
└── presentation/
    ├── cart_screen.dart
    └── widgets/ (cart_line_tile, coupon_field, cart_summary_card)
```

- **Widgets never call Dio.** Widgets → controllers (Riverpod) → repository → Dio.
- Domain models are plain Dart classes; DTOs stay in `data/`. For this app size, DTO and domain model may be the same class when there's no transformation (documented per feature — don't invent layers for their own sake).
- Shared cross-feature models (Product, Order) live in `features/catalog/data/models` / `features/orders/data/models` and are imported by others — no global `models/` dumping ground in v1; promote to `core/` only when used by 3+ features.

## 2.3 Dependency direction

```
presentation → application (controllers) → data (repositories/DTO) → core/network
     ↓                                                            ↓
   core/widgets                                            core/storage, config
```

---

# PART 2 — PHASE 3: STATE MANAGEMENT

## 3.1 Decision: **Riverpod** (not Bloc/Cubit)

| Criteria | Riverpod | Bloc |
|---|---|---|
| Boilerplate for ~15 features | Low (one Notifier class per feature) | Higher (Event/State/Handler triad) |
| Async loading/error | `AsyncValue<T>` built-in → loading/error UI is uniform | Manual states per bloc |
| Testability | Inject overrides, no BuildContext | Also good, more ceremony |
| Dependency between cart↔auth (merge on login) | Provider composition is trivial | Needs events/bloc-to-bloc wiring |
| Compile-time safety of deps | Yes (provider graph) | Partial |
| Team onboarding from React knowledge | Closest mental model to hooks/context | Closer to Redux |

Bloc would be justified with large teams wanting enforced event flows; for this app, Riverpod's less ceremony wins. **No codegen (riverpod_generator) in v1** — plain Riverpod keeps build_runner output small (only JSON).

## 3.2 State categories — global vs local

| State | Scope | Provider | Persistence |
|---|---|---|---|
| **Session/auth** (user, status: loading/authenticated/guest, accessToken in memory) | **Global** | `sessionControllerProvider` (AsyncNotifier) | refresh token + ch_sid in secure storage; access token in RAM only |
| **Server/API data** (products, categories, product detail, reviews, orders list, notifications) | Feature-scoped, auto-dispose | `productsProvider(queryFamily)`, `productDetailProvider(slug)`, etc. (`AsyncNotifier` / `FutureProvider.family`) | Optional in-memory cache (Phase 11) |
| **Cart** | **Global** (navbar badge + cart + checkout all read it) | `cartControllerProvider` (Notifier wrapping repo) | Server-side; guest identity via ch_sid |
| **Wishlist** | Global-while-authenticated | `wishlistControllerProvider` | Server-side |
| **Checkout** (selected address, payment method, placed order, stage) | **Feature-local** (disposed after confirmation) | `checkoutControllerProvider` (family by cartId or plain Notifier) | Pending payment intent persisted (Phase 7) |
| **Payment session state machine** | Feature-local but survives navigation | `paymentControllerProvider` | `PendingPaymentStore` in secure/prefs storage |
| **UI state** (tab index, filter drawer open, search field text, scroll, sheet) | **Local** — `StateProvider` inside feature or plain `StatefulWidget` | never global | no |
| **Form state** | **Local** — `Form` + `TextEditingController`s per screen | disposed with screen | no (address draft optional in prefs) |
| **Persistent local state** (recent searches, last shop filters, onboarding seen, notification permission asked) | via `prefs_store` (shared_preferences) | `settingsProvider` (Notifier over prefs) | shared_preferences |
| **App-wide settings from server** (tax, shipping, COD flag, store status) | Global, cached 5 min | `appSettingsProvider` (AsyncNotifier) | memory + prefs fallback |
| **Connectivity** | Global | `connectivityProvider` | — |

**Rules:**
- Never mirror server data into multiple controllers — one owner per resource; others read it.
- `cartControllerProvider` is refreshed after login/logout/order placement (single `refresh()` call).
- Screen-local state must not leak into `core/`.

---

# PART 3 — PHASE 4: API CLIENT

## 4.1 Layers

```
Screen ──► Controller (Riverpod) ──► Repository ──► DioClient ──► REST /api/*
                │                        │
           AsyncValue UI          DTO fromJson / toDomain
```

## 4.2 `core/network` design

**`AppConfig`** (from `--dart-define-from-file`): `apiBaseUrl`, `webAssetBase` (for `/images/*`), `env`, `razorpayKeyIdOverride` (unused — key comes from server), `enableLogging`.

**`DioClient`** (singleton):
- `baseUrl = AppConfig.apiBaseUrl` (e.g. `https://api.cuddlehug.com` / `http://10.0.2.2:5000` dev Android emulator).
- Timeouts: connect 15s, receive 30s (payment/status endpoints 10s).
- Headers: `Content-Type: application/json`, `Accept: application/json`, `X-Request-Id: <uuid>` (backend echoes it for tracing), `Authorization: Bearer <accessToken>` (from memory), `Cookie: ch_refresh=…; ch_sid=…` (from secure store — see Phase 5/6).
- `validateStatus: (s) => s != null && s < 500` → app parses error envelopes itself (4xx come as `{success:false,...}`).
- Interceptors (order):
  1. **CookieHeaderInterceptor** — injects `Cookie` header from secure store (applies to every request; server ignores it when not needed).
  2. **AuthInterceptor** — attaches Bearer; on `401 UNAUTHORIZED/INVALID_TOKEN` (and not the refresh call itself, and not `noRetry`) → **single-flight refresh** (Phase 5) → replay original request once; if refresh fails → dispatch logout.
  3. **RetryInterceptor** — idempotent GETs only: max 2 retries on `SocketException`/`TimeoutException`/5xx with 300ms→1s backoff. **Never auto-retry POST /orders, /payments/*, /cart/items.**
  4. **LoggingInterceptor** — `assert(kDebugMode)` only; masks `Authorization`, `Cookie`, password fields.

**Envelope parsing:**

```dart
class ApiEnvelope<T> { final bool success; final T? data; final Map<String,dynamic>? meta; ... }
// GET/POST helpers return (data, meta) or throw ApiException
class ApiException implements Exception {
  final int status; final String code; final String message; final dynamic details;
}
```

Every repository wraps Dio errors into `ApiException`; `NETWORK_ERROR` synthesized for no-connection/timeouts (matches web's `ApiError.code` behavior).

## 4.3 Endpoints & DTO rules

- `core/network/api_endpoints.dart` — all paths as constants (one place to audit).
- DTO conventions:
  - Money fields → `String` in DTO, parsed to `Money` value object (`int minorUnits` + `toString`) in domain — mirrors backend integer-paise math; format via `formatMoney` (Phase 16).
  - `payments/create-order.amount` → `int` (paise) — documented exception.
  - Dates → `DateTime.parse` (ISO-8601 UTC); display in `Asia/Kolkata`.
  - Nullable JSON → nullable Dart fields with `?? ` defaults; never throw on missing optional keys.
  - `meta` optional: `meta == null` ⇒ treat as unpaginated single page.
- Query serialization: skip null/empty (same as web's `buildQuery`).

## 4.4 Pagination model

```dart
class Paged<T> { final List<T> items; final int page, limit, total, totalPages; bool get hasMore => page < totalPages; }
```
`limit`: 48 max for products (use 20 mobile default), 100 elsewhere (use 12–20).

## 4.5 Image URL resolver (core)

```dart
resolveImageUrl(url):
  if (url empty) → placeholder asset
  if (http(s):// or data:) → as-is
  if (/uploads/...)  → apiBaseUrl + url
  if (/images/...)   → webAssetBase + url      // seeded assets live in frontend/public
  else → apiBaseUrl + url
```

---

# PART 4 — PHASE 5: AUTHENTICATION

## 5.1 What we keep vs change

The web model (access in memory, refresh in httpOnly cookie) **cannot be copied literally** — but the backend already proves raw `Cookie:` headers work (`scripts/smoke.mjs:21-34`). Two options:

| Option | Backend change? | Verdict |
|---|---|---|
| A. Flutter keeps its own "cookie jar": store raw `ch_refresh` value + `ch_sid`, send `Cookie:` header manually | None | Works today, verified by smoke tests |
| B. Add body/header fallback to refresh (`{refreshToken}` in body) while keeping cookie path for web | Small, backward-compatible | Cleaner long-term |

**Decision: implement Option A now (zero backend risk), and apply backend change B-1 below as RECOMMENDED hardening.**

## 5.2 Storage model

| Item | Where | Notes |
|---|---|---|
| `refreshToken` (raw JWT, = `ch_refresh` value) | flutter_secure_storage | 30-day validity, rotated |
| `sessionId` (= `ch_sid` UUID) | flutter_secure_storage | 30-day, guest cart identity |
| `accessToken` | **RAM only** (`SessionController` field) | 15-min expiry; never persisted |
| `user` profile snapshot | shared_preferences (non-sensitive: name, email, role) | for instant UI after cold start; revalidated by `/auth/me` |

Cold start: read refresh+sid from secure storage → if refresh exists → `POST /auth/refresh` (with Cookie header) → get `{user, accessToken}` → authenticated; else guest.

## 5.3 Refresh mechanics (race-safe)

```
SingleFlightRefresh:
  Completer<AccessToken>? inflight;
  Future<String> getOrRefresh() {
    if (inflight != null) return inflight!.future;      // all 401s share one refresh
    inflight = Completer();
    try { call POST /auth/refresh; store new access+cookie; complete }
    catch (e) { clearSecureSession(); completeError(LogoutEvent) }
    finally { inflight = null }
  }
```

Rules:
- **Proactive refresh**: schedule a timer at `exp − 60s` (decode JWT payload client-side for `exp`; no signature verification needed client-side) so most requests never see 401.
- On 401 from any request → one refresh → replay original once → if still 401 → force logout with "Session expired, please sign in again".
- Refresh failure with `403 ACCOUNT_BLOCKED` → logout + block message (don't loop).
- Refresh rotation: new `Set-Cookie: ch_refresh` on success — parse `set-cookie` response header and overwrite stored value (Dio exposes headers). **If parse fails, keep old value** (server may not rotate when reusing same token).
- Reuse detection: if server revokes the family (stale token reuse), we get 401 → clean logout. Multiple devices are independent (each device has its own RefreshToken row) — supported natively by backend.

## 5.4 Edge cases

| Case | Behavior |
|---|---|
| App restart | Restore session silently from secure storage (splash screen shows ≤ 800ms) |
| Concurrent 401s | Single-flight (above) |
| Expired refresh (30d) | 401 INVALID_TOKEN → clear storage → guest mode → redirect to login preserving `next` route |
| Logout from another device / password change (server revokes all) | Next refresh fails → auto logout with toast |
| Logout locally | `POST /auth/logout` with Cookie header (server revokes row) + clear secure storage + clear RAM → guest cart keeps `ch_sid` (web behaves the same) |
| Rate limited on login (429 RATE_LIMITED) | Parse `RateLimit-Reset` if present else exponential backoff UI ("Too many attempts — try in N min"); disable button |
| Blocked account | `403 ACCOUNT_BLOCKED` → dedicated screen state |

## 5.5 Backend changes (auth)

| ID | Change | Why | Endpoint/service | Web affected? | Backward compatible? | Migration |
|---|---|---|---|---|---|---|
| **B-1 (RECOMMENDED)** | `POST /api/auth/refresh` (and `/logout`) accept `{refreshToken}` in body **or** cookie, same rotation logic | Removes need for mobile cookie emulation; clearer contract | `auth.controller.ts:61,81` + `auth.service.refresh` | No — cookie path untouched | Yes (additive) | No |
| **B-2 (OPTIONAL)** | Record `deviceId`/`platform` on `RefreshToken` (fields already partially exist: userAgent/ip) for future "Active sessions" screen | Session management UX | `RefreshToken` model | No | Yes | **Yes** (add columns) |

No other auth backend changes. **Security is not weakened:** secret stays httpOnly-equivalent (secure storage), rotation + reuse detection unchanged.

---

# PART 5 — PHASE 6: GUEST CART

## 5.1 Strategy (simplest that works with existing backend)

**Server-side identity via persisted `ch_sid` cookie — no new backend code.**

1. On first app launch: if no `ch_sid` in secure storage → generate UUID locally? **No** — let the server mint it: make any request (e.g. `GET /api/settings`) and capture `set-cookie: ch_sid=…`; store it. (Alternative: generate UUID client-side matching `/^[a-f0-9-]{36}$/` — backend accepts it (`context.ts:20`). **Choose client-side generation** — avoids depending on a response header, and backend validates the format only.)
2. Every request sends `Cookie: ch_sid=<uuid>[; ch_refresh=<jwt>]`.
3. Cart endpoints resolve by `userId` when authenticated, else `sessionId` — exactly the web behavior.
4. **Login/register** → backend `mergeCarts` runs automatically (server sees both cookies in the same request that carries auth credentials). No client-side merge logic.

## 5.2 Lifecycle matrix

| Event | Behavior |
|---|---|
| App restart | `ch_sid` restored from secure storage → same cart |
| App reinstall | Storage wiped → new `ch_sid` → old guest cart orphaned server-side (same as web clearing cookies). **Accepted** — carts are cheap; no cleanup job needed |
| Guest → login | Server merges guest cart into user cart (qty clamped to 10/line). After login, `cartController.refresh()` shows merged result |
| Login → logout | User cart remains on server keyed by userId; client reverts to `ch_sid` cart (which is the pre-login guest cart, empty after merge — matches web) |
| Multiple devices (guest) | Distinct `ch_sid` → independent carts (correct) |
| Multiple devices (logged in) | Same user cart, server is source of truth; last write wins per line; cart has `FOR UPDATE` only at checkout — acceptable |
| Conflict / duplicate lines | Unique `(cartId, variantId)` upsert on server — impossible to duplicate |
| Variant archived while in cart | Server hides item but still totals it (known bug §0.2 #8) — client displays server `summary` but renders visible items; show notice if `summary` disagrees (defensive; fix RECOMMENDED backend) |
| Out of stock in cart | Server returns `inStock:false, maxQuantity:0` → UI shows "Out of stock", qty stepper disabled, checkout blocked server-side with 409 |
| Quantity > 10 | Server silently clamps — client also clamps locally via `maxQuantity` to avoid surprise |
| Store closed | Order create → 503 INVALID_STATE — show banner from settings (`store.status`) proactively |

## 5.3 Cart state sync rules

- `cartController` owns the single server cart DTO (the API returns full cart incl. summary after every mutation — use it directly, no local math for totals).
- Optimistic UI: allowed for qty stepper (revert on error + toast), **not** for coupon or checkout.
- After login/logout/order → explicit `refresh()`.

**Backend change: none required.** (RECOMMENDED B-4 below for summary/items consistency.)

---

# PART 6 — PHASE 7: RAZORPAY PAYMENTS

## 7.1 Flow (as specified — backend is source of truth)

```
Flutter                         Backend                         Razorpay
  │ POST /orders {RAZORPAY}       │                                │
  │──────────────────────────────►│ create order (PENDING),        │
  │◄────── order DTO ─────────────│ reserve stock, clear cart      │
  │ persist PendingIntent{orderId}│                                │
  │ POST /payments/create-order   │                                │
  │──────────────────────────────►│ create razorpay order (amt     │
  │                               │ from server total, paise)      │
  │                               │───────────────────────────────►│
  │◄─ {keyId, rzpOrderId, amount} │ store providerOrderId          │
  │ persist intent (rzp ids)      │                                │
  │ open RazorpayFlutter.checkout │                                │
  │───────────────────────────────────────────────────────────────►│
  │◄─ success {order_id,payment_id,signature} ─────────────────────│
  │ persist 3 fields LOCALLY      │                                │
  │ POST /payments/verify ───────►│ HMAC timingSafeEqual ──────────│
  │                               │ capturePayment (idempotent):   │
  │                               │ Payment=PAID, Order=CONFIRMED, │
  │                               │ confirmStock, notify, email    │
  │◄───── order DTO (PAID) ───────│                                │
  │ → /order-confirmation/:id     │                                │
```

- **Dev mode** (`intent.devMode == true`): skip Razorpay UI → `POST /payments/dev-complete` (backend gates it off in prod). Mirrors web exactly.
- **Never** let the client mark anything paid. Confirmation screen renders only from the order DTO returned by verify (or fetched via `GET /orders/:id`).

## 7.2 Pending-payment resilience (the hard part)

Persist `PendingIntent {orderId, orderNumber, rzpOrderId?, rzpPaymentId?, signature?, createdAt, stage}` in secure storage **before opening checkout**.

| Failure | Recovery |
|---|---|
| User cancels Razorpay modal | `PaymentDismissed` → clear intent → back to checkout with "Payment cancelled" (order remains PENDING, retry allowed) |
| Verify call fails (network) | Keep intent → retry verify with backoff (max 5) → if still failing, show "Confirming payment…" screen with manual Retry + "Check status later" |
| **App killed / crash after success response** | On next launch, if intent exists → `GET /api/payments/status?orderId=` → if `PAID` → jump to confirmation; if `PENDING` and we have signature → replay `POST /payments/verify` (server idempotent: repeat verify returns confirmed order, `payment.service.ts:183-188`) |
| Payment succeeded but client never sent verify and has no signature | Status stays PENDING — **webhook (B-3) confirms it server-side**; app polls status on resume and shows confirmation when PAID |
| Duplicate verify (retry double-tap) | Server idempotent — safe; client still single-flights verify |
| Duplicate `POST /orders` (double-tap place) | Client disables button + single-flight; server second call → `400 CART_EMPTY` (safe by side effect) |
| App backgrounded during Razorpay | `razorpay_flutter` delivers result on resume; also handle `didChangeAppLifecycleState` → if intent active → poll status once |
| Amount tampering | Impossible — amount derived server-side; signature covers `order_id\|payment_id` only; `rzpOrderId` must match stored `providerOrderId` before we even send verify (client-side sanity) |
| Order cancelled by admin mid-payment | `capturePayment` → 409 INVALID_STATE → clear intent, show message, refresh order |

**Polling:** `GET /payments/status?orderId=X` on app resume while intent exists; max 6 polls × 3s, then stop and show status screen (no infinite polling).

## 7.3 Backend changes (payments)

| ID | Change | Why | Endpoint/service | Web affected? | Backward compatible? | Migration |
|---|---|---|---|---|---|---|
| **B-3 (MUST)** | Add `POST /api/payments/webhook` verifying `x-razorpay-signature` with existing `verifyRazorpayWebhookSignature` (`razorpay.ts:85-89`), handling `payment.captured` → `capturePayment()` (idempotent) and `payment.failed` → mark Payment FAILED + notification. Register route before `express.json` raw-body handling (need raw body for HMAC — mount a raw body parser for this route only) | **Without it, a killed mobile app leaves orders PENDING forever with stock reserved — no reconciliation exists** (verified: no cron, no webhook calls). Mobile kill-during-payment probability ≫ web | new route in `commerce.routes.ts` or `payments.routes`; `payment.service.capturePayment` reused | No (new endpoint) | Yes (additive) | No |
| **B-4 (RECOMMENDED)** | Razorpay dashboard auto-capture must be ON (ops config) **or** webhook handler calls `POST /payments/:id/capture` before confirming | Backend never captures; currently relies on dashboard setting | `razorpay.ts` | No | Yes | No |
| **B-5 (RECOMMENDED)** | Validate `GET /api/payments/status` requires `orderId` (400 otherwise) — today missing param returns an arbitrary order | Correctness footgun | `payment.service.ts:269` | Web always sends orderId — unaffected | Strictly stricter, but web compliant | No |
| **B-6 (OPTIONAL)** | `Idempotency-Key` header support on `POST /api/orders` (store key, return same order) | Belt-and-braces vs double order | `order.service.ts` | No (header optional) | Yes | No |

Razorpay **public** key id is delivered inside `create-order` response (`keyId`) — the app stores no Razorpay secrets. ✅

---

# PART 7 — PHASE 8: COD (separate lifecycle review)

Verified behavior (`order.service.ts:195-252, 420-438`):

- Eligibility = settings key `shipping.codEnabled` (public via `GET /api/settings`). Checkout must read it live; if disabled server-side → `400 BAD_REQUEST "Cash on delivery is not available"` (handle gracefully: switch selection to online, show message).
- On create: `status = CONFIRMED` immediately, `paymentStatus = PENDING`, `estimatedDelivery = now+5d`, stock **reserved and deducted in the same transaction** (net: `quantity -= n` at creation), cart cleared, `ORDER_CONFIRMATION` notification.
- A `Payment` row is still created (`provider:RAZORPAY, status:PENDING`) — cosmetic oddity; mobile must **not** show "Pay now" for COD orders (`/payments/create-order` → 409 INVALID_STATE — handle and hide CTA).
- Lifecycle: `CONFIRMED → PROCESSING → PACKED → SHIPPED → OUT_FOR_DELIVERY → DELIVERED` (+ `CANCELLED/RETURNED/REFUNDED`).
- On `DELIVERED` for COD: server flips `paymentStatus=PAID`, `paidAt`, `Payment.status=PAID`.
- Cancellation: admin-only; `releaseStock` restores quantity (already-deducted path) — no client action.
- Returns/refunds for COD: server handles `RETURNED → REFUNDED` transitions; mobile only displays (no client-initiated return API exists).

**Mobile COD UX rules:**
1. Show COD only if `shipping.codEnabled` and cart total passes any future min-order rule (none exists today — don't invent client rules).
2. Order confirmation copy branches: COD → "Order confirmed! Pay on delivery"; online → "Payment successful!".
3. Order detail: for COD before DELIVERED show badge "Payment due on delivery" — derived from `paymentMethod == COD && paymentStatus != PAID`.
4. Never show Razorpay entry points for COD orders.

**Backend changes: none required for COD.** (OPTIONAL B-7: create `Payment` row only for online orders, or seed `method:"cod"` — cosmetic data-model cleanup, migration-free but touches `order.service.ts:238`.)

---

# PART 8 — PHASE 9: PUSH NOTIFICATIONS

## 9.1 Architecture (FCM — production standard for iOS+Android)

```
App start/login ──► firebase_messaging.getToken()
        │ POST /api/devices {token, platform: ios|android, appId, locale?}
        ▼
Backend: DeviceToken row (unique token, userId, platform, lastSeenAt)
        │ on notification events (existing 3 call sites + future)
        ▼
firebase-admin SDK → FCM HTTP v1 → device
        │ foreground → local display + in-app center
        │ background/terminated → system tray (FCM default) → tap → deep link
```

## 9.2 Backend changes (MUST for push)

| ID | Change | Why | Endpoint/service/model | Web affected? | Backward compatible? | Migration |
|---|---|---|---|---|---|---|
| **B-8 (MUST for push)** | New model `DeviceToken { id, userId, token @unique, platform, appId?, lastSeenAt, createdAt }`; endpoints `POST /api/devices` (upsert by token), `DELETE /api/devices/{token}` (logout), `GET /api/devices` (optional); after each `prisma.notification.create` (existing 3 sites: `auth.service.ts:101`, `order.service.ts:269/456`, `payment.service.ts:198/251`) also send FCM push via `firebase-admin` when `FIREBASE_SERVICE_ACCOUNT` configured (graceful no-op otherwise, like Resend email) | Push is a hard requirement; no device/push code exists at all | `prisma/schema.prisma` (new model), new `device.routes.ts` or extend `account.routes.ts`, `push.service.ts` | No (additive) | Yes | **Yes** — `prisma migrate dev add_device_tokens` |
| **B-9 (RECOMMENDED)** | `data` payload in push: `{type, orderId?, productSlug?}` so tap can deep-link; also set `Notification.data` already exists — reuse | Deep links (below) | same as B-8 | No | Yes | No |
| **B-10 (OPTIONAL)** | Per-user notification preferences (`push.order`, `push.promo`) stored in SiteSetting or new table; filter push send | Promotional opt-out / compliance | `push.service` | No | Yes | Maybe |
| **B-11 (OPTIONAL)** | Promotional push tool (admin) reusing `GENERAL` notifications | Marketing | admin route | No | Yes | No |

**We extend the existing `Notification` model/API** (in-app center keeps working via `GET /api/notifications`, `unread-count`) — no second system. Push is a delivery channel for the same rows.

## 9.3 Notification types → push mapping (reuse enum)

| Event (existing) | `NotificationType` | Push title/body template | Deep link |
|---|---|---|---|
| Register | GENERAL | "Welcome to CuddleHug 🧸" | `cuddlehug://home` |
| Order created | ORDER_CONFIRMATION | "Order {n} confirmed" | `/orders/{orderId}` |
| Payment captured | PAYMENT_CONFIRMATION | "Payment of ₹{amt} received" | `/orders/{orderId}` |
| SHIPPED / OUT_FOR_DELIVERY | SHIPPING | "Your bears are on the way" | `/orders/{orderId}` |
| DELIVERED | DELIVERY | "Delivered — time for hugs!" | `/orders/{orderId}` |
| CANCELLED / REFUNDED | PAYMENT_CONFIRMATION | "Order {n} refunded" | `/orders/{orderId}` |
| Promo (future, B-11) | GENERAL | campaign text | `/shop` or product slug |

## 9.4 App-side handling

- **Token lifecycle:** get token after login (and on `onTokenRefresh`); `DELETE /devices` on logout (don't delete on uninstall — server cleans tokens that FCM reports `UNREGISTERED`; OPTIONAL background job).
- **Permission:** request on first meaningful trigger (after first order OR first app open post-login) using `FirebaseMessaging.requestPermission()` (iOS) — never block onboarding.
- **Foreground:** `onMessage` → show via `flutter_local_notifications` (or in-app snackbar if user is on that screen) + increment unread badge (`unread-count` endpoint or local increment).
- **Background:** FCM default tray display (notification payload) — no custom handler needed.
- **Terminated:** launch from tray → `FirebaseMessaging.getInitialMessage()` → route to deep link after splash bootstrap.
- **Deep link handling:** `deep_link_handler.dart` maps `{orderId}` → `/orders/{id}` (verify ownership — server 404s others), `{productSlug}` → `/product/{slug}`, unknown → home. Route guard: if not authenticated → login with `next`.
- **Polling fallback:** while not yet registered for push (permission denied), poll `GET /notifications/unread-count` every 60s on foreground only (badge + center). This preserves full functionality without push.
- **In-app center** = existing endpoints (list, mark read, read-all) — nothing new.

---

# PART 9 — PHASE 10: IMAGE & CLOUDINARY OPTIMIZATION

## 9.1 Sources & resolver

Exact resolver defined in Phase 4.5 (`/images/*` → webAssetBase, `/uploads/*` → API base, absolute → passthrough).

## 9.2 Cloudinary URL transformation (client-side, no backend change)

For URLs matching `res.cloudinary.com/.../image/upload/`, insert delivery transformations after `upload/`:

| Use case | Transform | Width budget |
|---|---|---|
| Grid/product card thumbnail | `w_400,h_400,c_fill,q_auto,f_auto` | 400px |
| Category tile | `w_500,c_fill,q_auto,f_auto` | 500px |
| Product detail main | `w_900,q_auto,f_auto` | 900px |
| Hero/banner | `w_1280,q_auto,f_auto` | 1280px |
| Wishlist/order line | `w_200,h_200,c_fill,q_auto,f_auto` | 200px |

`f_auto` gives WebP/AVIF per device — saves bandwidth for free.

> This only works when Cloudinary is configured (prod). Seeded `/images/*` and local `/uploads/*` have **no server-side transform** (verified) — handled by client downscaling below.

## 9.3 Caching & memory strategy

- `cached_network_image` everywhere; `maxStale` 7 days for catalog, 30 days for category/hero.
- **Always pass `cacheWidth`** (physical pixels × devicePixelRatio rounded) so large originals are decoded into small bitmaps — prevents OOM from full-size seeds:
  - card: `cacheWidth: 400 * dpr`, detail: `900 * dpr`.
- Placeholder: `ShimmerBox` (mimics web `.skeleton` shimmer) with fixed `aspectRatio` to prevent layout jumps (grid uses aspect-square, category tile 4/5).
- Error state: warm cream fallback tile with teddy icon (not broken-image icon) + tap to retry (re-`resolve` with cache-buster).
- Hero animation: card → detail image (web has subtle scale; Flutter `Hero` gives native polish).
- Memory: rely on Flutter's image cache defaults (100MB/1000 entries); tune to 50MB if low-end devices show pressure.

## 9.4 Uploads (v1 = no admin app; kept for future)

If/when an admin mobile upload is needed: `http` multipart with compression (recompress to ≤ 2MB via `flutter_image_compress`), progress via Dio `onSendProgress`, cancel token, validate ≤ 5MB + mime whitelist client-side (mirrors `upload.ts`). **Not built in v1.**

**Backend changes: none required.** (RECOMMENDED B-12: on upload, also store Cloudinary `public_id` and serve transformed URLs from server for seeded images too; OPTIONAL B-13: migrate seed `/images/*` to absolute CDN URLs so a third client can't break.)

---

# PART 10 — PHASE 11: NETWORK & OFFLINE BEHAVIOR

## 10.1 Error taxonomy → UI mapping

| Condition | Detection | UI |
|---|---|---|
| No internet | `connectivity_plus` + Dio `SocketException` → `NETWORK_ERROR` | Persistent slim banner under app bar: "You're offline" + Retry; cached screens still viewable |
| Timeout | `DioTimeoutException` | Inline error card with Retry (GET); for POST show toast, keep form data |
| Server unavailable (5xx/000) | status ≥500 / connect error | Same as timeout; after 2 failures show maintenance-style screen on critical paths (checkout) |
| 401 | handled by AuthInterceptor | silent refresh → retry → else logout |
| 403 | `FORBIDDEN` / `ACCOUNT_BLOCKED` | message inline; blocked → dedicated screen |
| 404 | `NOT_FOUND` | product/order screens → friendly "not found" page (web's "slipped under the sofa" copy); others → toast + pop |
| 409 | `OUT_OF_STOCK` / `INVALID_STATE` / `CONFLICT` | contextual: OOS → refresh cart + banner; INVALID_STATE → refresh order; CONFLICT → form error |
| 422/400 `VALIDATION_ERROR` | `details:[{path,message}]` (dev only!) | map `path` → field error when details present; else generic message. **Never rely on details in prod** (stripped) |
| 429 | `RATE_LIMITED` | countdown backoff UI; disable submit |
| Interrupted checkout | cart preserved server-side | resume = reopen checkout |
| Interrupted payment | `PendingIntent` (Phase 7) | resume/verify/poll |
| Stale catalog | revalidate on tab focus (`ref.invalidate`) | pull-to-refresh always available on lists |

## 10.2 Caching (simple, no offline-first engine)

- **Nothing persistent offline in v1** except images (cached_network_image) + tiny prefs (recent searches, last filters).
- Optional lightweight: cache last home payload (`/content/home`) in prefs → render instantly on cold start, refresh in background (stale-while-revalidate). **Do this only if cold-start metrics demand it.**
- Explicitly out of scope: offline cart editing, background sync, queue-and-retry mutations — e-commerce checkout requires fresh prices/stock anyway.

## 10.3 Request policies

- GET: retry ×2 (300ms, 1s), `refetchOnForeground` for lists.
- Mutations: **no auto-retry**; single-flight per logical action (buttons disabled while in-flight).
- Polling: only `payments/status` (Phase 7) and `unread-count` (foreground, 60s, only if push unavailable).

---

# PART 11 — PHASE 12: API CONTRACT REVIEW (from Flutter's perspective)

## MUST CHANGE (blocks or compromises the mobile app)

| # | Issue | Evidence | Fix |
|---|---|---|---|
| **M1** | **No Razorpay webhook / no reconciliation** → app killed after successful payment leaves order PENDING + stock reserved forever; mobile is far more kill-prone than web | `razorpay.ts:85-89` unused; no cron anywhere | **B-3** webhook endpoint (`payment.captured` → idempotent `capturePayment`) |
| **M2** | **No push infrastructure** while push is a requirement | 0 hits for fcm/deviceToken | **B-8** DeviceToken model + endpoints + firebase-admin sender (migration required) |

## RECOMMENDED (real problems, not style)

| # | Issue | Fix |
|---|---|---|
| R1 | Refresh/logout cookie-only contract is browser-shaped | **B-1** body fallback (additive) |
| R2 | `details` stripped in prod → `OUT_OF_STOCK` "only N left" unreachable | Keep `details` for whitelisted codes (`OUT_OF_STOCK`, `VALIDATION_ERROR`) in prod |
| R3 | Cart `items` vs `summary` mismatch (archived lines still priced) | Compute summary from filtered rows (`cart.service.ts:138`) |
| R4 | `/payments/status` missing `orderId` returns arbitrary order | **B-5** validate required param |
| R5 | No idempotency key on `POST /orders` | **B-6** optional header |
| R6 | `useDifferentBillingAddress` parsed but ignored | Either honor it or drop from schema (silent no-op confuses clients) |
| R7 | Seeded `/images/*` resolve to web origin — fragile for a third client | Serve `/images` from API (static mount) **or** migrate seed URLs to absolute/CDN (**B-13**) |
| R8 | Backend never captures payment (dashboard auto-capture dependency) | **B-4** capture in webhook/verify path |
| R9 | `Payment.method` hard-coded `"card"` | Store actual method from Razorpay webhook payload |

## OPTIONAL (nice-to-have)

| # | Improvement |
|---|---|
| O1 | OpenAPI/Swagger spec generated from Zod (client contract + doc) |
| O2 | `hasMore` in pagination meta (client can compute `page < totalPages` today) |
| O3 | Cursor pagination for large lists (orders/notifications) |
| O4 | `Retry-After` header on 429 (currently only `RateLimit-Reset`) |
| O5 | `X-Session-Id` request header alternative to `ch_sid` cookie |
| O6 | ETag/If-None-Match on `/products/:slug` |
| O7 | Device/session listing API for account security screen (**B-2**) |

**Do NOT change:** envelope format, money-as-string DTOs (client handles), REST paths, auth RBAC, pricing logic — the web app and tests depend on all of these, and they're coherent.

---

# PART 12 — PHASE 13: CUSTOMER APP vs ADMIN APP

**Decision: v1 = Customer app only.**

Reasons:
- The web admin dashboard is complete (11 sections incl. reports/charts) — recreating it in Flutter duplicates ~40% of effort for zero new capability.
- Admin usage is low-frequency, desk-bound (charts, tables, CSV-like reports) — web is the right surface.
- Mobile admin adds security surface (storing admin sessions on phones) with little benefit.

**Customer app scope (final):**
Home · Shop/Categories · Search · Product detail (+reviews) · Cart · Wishlist · Checkout (address + Razorpay + COD) · Order confirmation · My orders + tracking · Write/my reviews · Address book · Notifications center · Profile/password · Support static pages.

**Selected admin-on-mobile (phase 2+, only if business demands):**
1. **Order status quick-action** (push-driven: "New order → mark PENDING→CONFIRMED/PACKED") — highest mobile value, tiny screen.
2. Low-stock alert push (needs B-8 + threshold event — OPTIONAL backend hook).

Everything else stays web. These use the existing `PATCH /admin/orders/:id/status` + `requireAdmin` — no new backend.

---

# PART 13 — PHASE 14: RESPONSIVE PHONE + TABLET UI

## 14.1 Breakpoints (aligned to web Tailwind + Material window classes)

| Class | Width | Target | Layout behavior |
|---|---|---|---|
| **compact** | < 600dp | Phones | `NavigationBar` (bottom), 2-col product grid, full-screen detail, bottom-sheet filters/dialogs, edge-to-edge with safe-area |
| **medium** | 600–839dp | Tablet portrait, foldables | `NavigationBar` still bottom (or top), 3-col grid, gutters 24dp, dialogs stay centered (max-width 480), cart single-pane with wider summary |
| **expanded** | ≥ 840dp | Tablet landscape, iPad | **`NavigationRail`** left, 4-col grid, max content width 1280dp centered, **two-pane** layouts (below), side sheets for filters |
| wide | ≥ 1024dp | iPad landscape / desktop-mode | same as expanded; cap at 1280 (`max-w-7xl` equivalent) |

Implementation: `core/routing/responsive.dart` with `Breakpoints.of(context)` helpers — one `LayoutBuilder` per shell, never scattered MediaQuery checks in widgets.

## 14.2 Two-pane (expanded only) — mirrors web `lg:` behavior

| Screen | Phone | Tablet (expanded) |
|---|---|---|
| Shop | list + filter **bottom sheet** (web uses right drawer; native sheets feel right on phone) | left filter rail 240dp + grid (web `lg:grid-cols-[240px_1fr]`) |
| Product detail | stacked gallery → info | `grid-cols-2`: gallery left (sticky), buy box right |
| Cart | stacked lines → summary | lines 1fr + summary 340dp sticky right |
| Checkout | stepper single column | address+payment left, sticky order summary 340dp right |
| Account | list of sections → push detail | left nav 220dp + content (web `md:grid-cols-[220px_1fr]`) |
| Order detail | stacked | timeline left, items/address right |
| Notifications | list | master-detail (list 360dp + detail) on expanded |

## 14.3 Other rules

- Orientation: support both; grids reflow via `SliverGridDelegateWithMaxCrossAxisExtent` (2→3→4 cols by breakpoint, `childAspectRatio` ~0.72 for cards to match web aspect-square + text).
- Safe areas: `SafeArea` top on all screens; bottom nav adds `viewPadding.bottom` padding; edge-to-edge on Android with scrim behind `NavigationBar`.
- Sheets: `showModalBottomSheet` on compact/medium; dialogs on expanded (mirrors web `dialog.tsx`: sheet on phone, modal ≥640px).
- Minimum tap targets 44×44 (web hover-only actions — wishlist/quick-add on cards — become tap-visible on touch; cards get persistent bottom action row on compact).
- Type: keep web type scale (12/14/16/18/24/30/48 hero) — do not scale up on tablet beyond gutter changes.

---

# PART 14 — PHASE 15: NAVIGATION

## 15.1 Router (go_router) structure

```
StatefulShellRoute (IndexedStack — preserves tab state)
├── /home          → HomeScreen        (tab 1)
├── /shop          → ShopScreen        (tab 2)   (supports /shop?query)
├── /cart          → CartScreen        (tab 3, badge = cart count)
└── /account       → AccountScreen     (tab 4)

Top-level (outside shell):
/splash                                   splash (bootstrap)
/login /register /forgot-password /reset-password/:token
/categories                               category grid
/category/:slug                           category → shop filtered
/search                                   search screen
/product/:slug                            product detail
/checkout                                 (auth-guarded)
/order-confirmation/:id                   (auth-guarded)
/orders  /orders/:id                      (auth-guarded)
/wishlist                                 (auth-guarded)
/addresses /reviews /notifications /profile   (auth-guarded, push from account)
/support/:doc                             static content (about, faq, shipping, returns, privacy, terms, care, contact)
/order-status/:orderId                    payment-resume screen (from PendingIntent)
*                                         not-found
```

## 15.2 Guards & redirects

```dart
redirect: (context, state) {
  if (bootstrapping) return '/splash';
  final authed = session.status == authenticated;
  final needsAuth = protectedRoutes.any((r) => state.matchedLocation.startsWith(r));
  if (needsAuth && !authed) return '/login?next=${Uri.encodeComponent(state.uri.toString())}';
  if (onAuthRoute && authed) return (next ?? '/home');
  return null;
}
```

- Protected: `/checkout`, `/orders*`, `/wishlist`, `/addresses`, `/reviews`, `/notifications`, `/profile`, `/order-confirmation/*`.
- Guest on `/cart` is allowed (guest cart works) — checkout button routes to login with `next`.
- After login/register → `next` param or `/home`.

## 15.3 Deep links

- Scheme: `cuddlehug://` (custom) **+** HTTPS App Links/Universal Links (`https://www.cuddlehug.com/...` mirroring web paths: `/products/:slug`, `/orders/:id` after auth).
- Android: `AndroidManifest` intent-filters + assetlinks.json on domain; iOS: `apple-app-site-association` + Associated Domains entitlement. (Domain setup = release-time task.)
- Unknown/deleted product → product screen handles `404 NOT_FOUND` → in-place "Borrowed by someone else" not-found view with links to shop (no redirect loop).
- Push taps → payload map → `deep_link_handler` (Phase 9).

## 15.4 Platform behaviors

| Concern | Behavior |
|---|---|
| Android back | go_router `pop`; on root tab → system default (background). **Blocked during payment processing** (predictor: `PopScope(canPop: false)` while payment stage active) and during place-order in-flight |
| iOS swipe-back | works on pushed routes; disabled on shell tabs (no stack) |
| App resume | revalidate visible providers; check `PendingIntent`; refresh session if near expiry |
| Payment return | `razorpay_flutter` result callback → verify flow; resume path via `/order-status/:orderId` if cold-started |
| 401 mid-navigation | logout → redirect to `/login?next=<current>` + toast |

---

# PART 14 — PHASE 16: DESIGN SYSTEM (native recreation of CuddleHug brand)

Extracted from `frontend/src/app/globals.css` + `components/ui/*` (verified values).

## 16.1 Color tokens (`core/theme/colors.dart`)

```dart
class AppColors {
  static const background   = Color(0xFFFFFAF6);  // --color-background
  static const foreground   = Color(0xFF2C1D16);  // --color-foreground
  static const card         = Color(0xFFFFFFFF);
  static const cardMuted    = Color(0xFFFDF6F0);
  static const primary      = Color(0xFFE0674F);  // --color-primary
  static const primaryDark  = Color(0xFFC14E37);  // hover
  static const onPrimary    = Color(0xFFFFFFFF);
  static const secondary    = Color(0xFFF6ECE5);
  static const onSecondary  = Color(0xFF5B463B);
  static const muted        = Color(0xFFF5EFE9);
  static const onMuted      = Color(0xFF7B6A60);  // muted-foreground
  static const accent       = Color(0xFFF9E2D7);
  static const onAccent     = Color(0xFF8A4A35);
  static const destructive  = Color(0xFFD64545);
  static const success      = Color(0xFF2F9E6F);
  static const warning      = Color(0xFFD99B28);
  static const border       = Color(0xFFEADFD6);
  static const inputBorder  = Color(0xFFE3D6CB);
  static const cream        = Color(0xFFFDF3EA);  // brand bg (price panel, footer)
  static const cocoa        = Color(0xFF6B4A35);  // brand ink
  static const blush        = Color(0xFFF7D9D0);  // selection
  // alpha tints (web uses /12 etc.) → Color.fromRGBO with alpha:
  static const primaryTint  = Color(0x1FE0674F);  // bg-primary/12 ≈ selected chips
  static const successTint  = Color(0x1F2F9E6F);
  static const warningTint  = Color(0x26D99B28);
  static const destructiveTint = Color(0x1FD64545);
}
```
Light-only (`Brightness.light` forced) — web has no dark mode; do not invent one.

## 16.2 Typography

- Font: **Inter** bundled as asset (web declares Inter but loads system fallback — bundle real Inter for consistency: `GoogleFonts.interFont()` or asset files).
- Scale (match Tailwind px): caption 11/12, body 14, body-lg 16, h5 18, h4 24 (page titles, bold), h3 30, h2 36, display 48/60 (hero, bold, letterSpacing −0.5, height 1.05).
- Weights: regular 400, medium 500 (labels), semibold 600 (buttons, card titles), bold 700 (headings/prices).
- Eyebrow: 12sp semibold, letterSpacing 0.6, uppercase, `onMuted` (or `primary` for category).
- Money: `fontFeatures: [FontFeature.tabularFigures()]` on prices.

## 16.3 Shape, elevation, motion

```dart
radii: sm 4, md 9.6→ use 10, lg 14.4→ use 14, xl 22.4→ use 22, full 999
shadows (color #2C1D16):
  soft: [0,1,2 @4%,  0,8,24,-12 @18%]
  lift: [0,2,6 @6%,  0,18,40,-20 @35%]
motion: fadeUp (8px rise, 500ms, easeOut) for screen/sheet entry;
        shimmer 1.4s for skeletons; 150ms implicit transitions on color/scale;
        card press: scale 0.98 (web has -translate-y hover → on touch use press feedback)
```

## 16.4 Component kit (`core/widgets`)

| Web component | Flutter equivalent | Spec (verified from web) |
|---|---|---|
| Button primary | `AppButton.filled` | h40 (md), h48 (lg), h32 (sm); radius md; label 14 semibold; `primaryDark` pressed; disabled opacity 0.55; loading = 16px spinner |
| Button secondary/outline/ghost | variants | outline: 1px `inputBorder`, pressed border+text `primary` |
| Input | `AppTextField` | h40, radius md, border `inputBorder`, fill `card`, focus 2px `primary` ring, label 14 medium, error 12 `destructive`, hint 12 `onMuted` |
| Card | `AppCard` | radius lg, 1px `border`, fill `card`, shadow soft, padding 20 |
| Badge | `AppBadge` | pill, h~20, 11sp semibold uppercase, tinted bg per tone (primary/success/warning/destructive/info=cocoa/neutral) |
| Stars | `AppStars` | size prop (12/14/16/24), empty = `border` color, filled `warning` |
| QuantityStepper | `QuantityStepper` | h40 border, ±36px, value tabular, min 1 max `maxQuantity` |
| Skeleton | `ShimmerBox` | `muted` bg + sweep 1.4s; `ProductCardSkeleton` aspect-square + text bars |
| EmptyState | `EmptyState` | icon in 56px `accent` circle, title 16 semibold, desc 14 `onMuted`, centered, pad y64 |
| Dialog/sheet | `showAppSheet/showAppDialog` | phone: bottom sheet rounded-top-xl, max h 92%, fade-up; tablet: centered ≤520/720px, scrim foreground@45% + blur |
| Toast | `riverpod`+`Overlay` or `toastification` | top-center, card bg + border, success/error colors; match sonner look |
| Tabs (segmented) | `SegmentedButton`-style custom | border container `muted` fill, radius lg, pad 4; active = card + soft shadow |

## 16.5 Order status presentation (from `lib/format.ts`)

| Status | Label | Badge tone |
|---|---|---|
| PENDING | Pending | warning |
| CONFIRMED / DELIVERED | Confirmed / Delivered | success |
| PROCESSING | Processing | neutral |
| PACKED / SHIPPED / OUT_FOR_DELIVERY | Packed / Shipped / Out for delivery | info (cocoa) |
| CANCELLED / RETURNED / REFUNDED | … | destructive |

Money format: `Intl`-equivalent via `intl` package — `NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0..2)` (Indian grouping, ₹0 for empty, max 2 decimals) — mirrors `formatMoney`. Dates: `d MMM yyyy` (en_IN), 12h clock with am/pm as web.

---

# PART 15 — PHASE 17: SECURITY

| Area | Decision |
|---|---|
| Token storage | Access = RAM only; refresh + ch_sid = flutter_secure_storage (Keychain / EncryptedSharedPreferences). **Never SharedPreferences/plain prefs** |
| Secrets in app | **None.** No JWT secrets, no DB creds, no Razorpay secret, no Cloudinary API secret, no Resend key. Only public config: API base URL, web asset base, Firebase config (public by design), app flavor flags |
| Razorpay key | Delivered by `POST /payments/create-order` (`keyId`) at runtime — not even hardcoded |
| HTTPS | Prod API must be HTTPS (TLS 1.2+); Android `networkSecurityConfig` **cleartext disallowed** in release; dev allows cleartext only to `10.0.2.2`/localhost via debug-only config |
| Certificate pinning | OPTIONAL for v1 (rotational pain); recommended later via `SecurityContext` pinning on the API host with backup pins |
| Authorization | Bearer for identity; RBAC enforced server-side (`requireAdmin`); client guards are UX only |
| Logs | `LoggingInterceptor` compiled out of release (`assert`); tokens/cookies/passwords redacted; no PII in Crashlytics (scrub email/phone in `setCustomKeys` before) |
| Crash reporting | Firebase Crashlytics (release only) — no user identifiers |
| Analytics | Firebase Analytics (release only), no payment data events |
| Root/jailbreak | Do not block (usability); OPTIONAL jailbreak detection → warning banner only. Server-side risk is unchanged (tokens rotate) |
| Screenshot protection | Only consider `FLAG_SECURE` on payment screen (Android) — OPTIONAL; iOS blocks screenshots only in limited contexts; checkout shows no card data (Razorpay handles it) so risk is low |
| Clipboard | Never copy tokens; order numbers copyable (harmless) |
| WebView | Not used at all (native Razorpay SDK) — avoids JS-bridge risk |
| Deep-link hijack | Verify `orderId` ownership server-side (404 for others) — already enforced |
| Payload | Server strips error `details` in prod (verified) — client never displays raw internals |
| Builds | Release: R8/ProGuard on, tree-shake icons/fonts, `--obfuscate --split-debug-info` for Dart, no `print` in prod |
| Session hygiene | Logout revokes server-side; password change revokes all (backend already does) → other devices force-logout on next refresh |

---

# PART 16 — PHASE 18: PERFORMANCE

| Area | Plan | How measured |
|---|---|---|
| Startup | Splash ≤ 800ms: restore secure session in parallel with `GET /content/home`; render cached snapshot if available | `flutter run --profile` timeline; target cold start < 2.5s on mid-range Android |
| App size | No unused assets; Inter subset; R8; exclude unused platforms from Firebase | `du -sh build/`; target Android AAB < 20MB, iOS < 25MB |
| Image memory | mandatory `cacheWidth`/`cacheHeight`; `cached_network_image`; avoid full-res decode | DevTools memory chart on shop scroll |
| Lists/grids | `ListView.builder`/`GridView.builder` (slivers), keys, `RepaintBoundary` on cards, avoid `Expanded` misuse | jank meter 60fps scroll on shop grid |
| Rebuilds | Riverpod `select` for badge (cart count only), `const` widgets, no setState in build | DevTools rebuild counts |
| API | batched `/content/home` (1 call for home), 30–60s revalidate, GET caching headers respected, no N+1 (related products fetched lazily below fold) | network profiler |
| Pagination | limit 20 mobile, load-more (infinite scroll) with page guard | — |
| Parsing | json_serializable; isolate spawn only if profile shows >16ms frame during parse (unlikely at limit 20) | DevTools |
| Animations | implicit animations only; hero on product image; disable shimmer when reduced-motion (Accessibility) | — |
| Battery | foreground-only polling, no background sync, FCM instead of polling when available | Battery historian spot-check |
| Premature optimization | **No** isolates for everything, no custom rendering, no offline DB until metrics prove need | — |

---

# PART 17 — PHASE 19: TESTING

## 17.1 Unit tests (`test/`)

| Module | Cases |
|---|---|
| `money` formatter/parser | ₹ formatting (en_IN grouping), decimal handling, parse "1728.64" → minor units, edge: "0.00" |
| Envelope/DTO parsing | success w/o meta, w/ meta, error envelope, missing keys, `amount` paise vs string money |
| `image_url_resolver` | `/images/*`, `/uploads/*`, absolute, data:, null |
| Auth single-flight | concurrent 401s → exactly one refresh call; failure → logout; replay works; refresh rotation stores new cookie |
| Cookie header builder | with/without refresh, format correctness |
| Payment state machine | every transition: cancel, verify-fail-retry, cold-start resume (status PAID/PENDING/FAILED), idempotent verify |
| Cart controller | add/update/remove optimistic+revert, coupon errors (`INVALID_COUPON`), clamp to maxQuantity |
| Checkout controller | COD vs online branching, devMode branch, settings-disabled COD |
| Router guards | protected redirects, `next` preservation, post-login routing |
| Form validators | phone 10-digit, pincode 6-digit, password ≥8 letter+digit (mirror `common.ts`) |

Mocks: `mocktail`; Dio tested via `http_mock_adapter` or custom `HttpClientAdapter`.

## 17.2 Widget tests (`test/features/**`)

ProductCard (badge/price/OOS), CartLine + stepper limits, CouponField states, Address radio selection, PaymentOption selection, Login/Review forms (validation + submit states), EmptyState/ErrorView, AppBadge tones, QuantityStepper, Stars (fractional), Pagination widget, Checkout summary rows (FREE shipping display, coupon negative amount).

Golden tests (optional, later) for theme drift: `product_card_golden`, `checkout_golden`.

## 17.3 Integration tests (`integration_test/`, run against local backend + seeded DB)

1. Register → auto login → home renders
2. Login (customer seed) → `/auth/me`
3. Browse: shop filters (category/size/price/sort) → product detail → variant select
4. Guest cart: add → restart app (new isolate simulating relaunch with same secure storage) → cart persists → login → **merge verified**
5. Coupon: valid `CUDDLE10` applied to summary; invalid → error
6. COD checkout → order CONFIRMED → appears in My Orders → confirmation screen copy
7. Razorpay dev flow (`devPaymentMode`): create order → dev-complete → PAID; replay verify → still PAID, stock unchanged
8. Razorpay **failure path**: cancel modal → order stays PENDING → retry → success
9. Order history + detail + status timeline
10. Reviews: write after purchase → pending moderation; duplicate → 409
11. Logout → guest state → protected route redirects to login with `next`

## 17.4 Backend compatibility tests

- **Run the existing backend suite unchanged** (`cd backend && npm test`) after every backend change (B-1…B-13) — this is the primary guarantee the web app keeps working.
- Existing `scripts/smoke.mjs` continues to pass (it already proves raw cookie flows).
- New backend changes get **their own backend tests** in the same style: webhook signature valid/invalid/idempotent (B-3), device token register/refresh/delete + push no-op without config (B-8), refresh body fallback (B-1), status orderId validation (B-5).
- Frontend suite (`cd frontend && npm test && npm run typecheck`) also unchanged.

---

# PART 18 — PHASE 20: ENVIRONMENTS

## 20.1 Three flavors

| | dev | staging | prod |
|---|---|---|---|
| `apiBaseUrl` | `http://10.0.2.2:5000` (Android emu) / `http://localhost:5000` (iOS sim) | `https://staging-api.cuddlehug.com` | `https://api.cuddlehug.com` |
| `webAssetBase` | `http://10.0.2.2:3000` | `https://staging.cuddlehug.com` | `https://www.cuddlehug.com` |
| `env` | `development` | `staging` | `production` |
| App id | `com.cuddlehug.app.dev` | `com.cuddlehug.app.staging` | `com.cuddlehug.app` |
| Firebase project | dev project | staging project | prod project (`firebase_options_dev.dart` etc.) |
| Logging | verbose + Dio logs | minimal | Crashlytics only, no Dio logs |
| Payment | backend devMode (no Razorpay keys) | Razorpay **test** keys (server-side) | Razorpay live |
| Push | dev FCM | staging FCM | prod FCM |

Mechanism: `flutter run --dart-define-from-file=config/dev.json` + flavors in `android/app/build.gradle` and `ios/.../Xcode project` (`flavorizr` can generate). **No production URL hardcoded in source** — all env data comes from the dart-define file; `prod.json` is the only place with prod URLs (public info, committed or CI-injected).

## 20.2 Backend env prerequisites per environment (no app impact)

- prod: `RAZORPAY_*` set (disables devMode), `FIREBASE_SERVICE_ACCOUNT` set (enables push), `FRONTEND_URL` = web domain (CORS for web only), `COOKIE_DOMAIN` correct for web cookies.
- staging: Razorpay test keys, staging Firebase service account.

## 20.3 CI/CD (recommended)

- PR: `flutter analyze` (strict) + `flutter test` + backend/frontend suites.
- Main: build AAB + IPA (Fastlane), upload to Play Internal / TestFlight.
- Release: phased rollout; Crashlytics + Analytics monitored.

---

# BACKEND MODIFICATION SUMMARY (master table)

| ID | Change | Priority | Web affected? | Backward compatible? | Migration |
|---|---|---|---|---|---|
| B-1 | Refresh/logout accept `refreshToken` in body (cookie path kept) | RECOMMENDED | No | Yes (additive) | No |
| B-2 | Device metadata on RefreshToken (active sessions UI) | OPTIONAL | No | Yes | Yes (columns) |
| **B-3** | **Razorpay webhook `POST /api/payments/webhook` → idempotent capture/failed** | **MUST** | No (new route) | Yes | No |
| B-4 | Server-side capture call (or documented auto-capture requirement) | RECOMMENDED | No | Yes | No |
| B-5 | `/payments/status` requires `orderId` | RECOMMENDED | No (web complies) | Yes (stricter) | No |
| B-6 | `Idempotency-Key` on `POST /orders` | OPTIONAL | No (optional header) | Yes | No |
| B-7 | COD Payment row cosmetics | OPTIONAL | No | Yes | No |
| **B-8** | **`DeviceToken` model + `/api/devices` + FCM sender hooked to existing notification creations** | **MUST (for push)** | No (additive) | Yes | **Yes** |
| B-9 | Structured push `data` payload for deep links | RECOMMENDED (with B-8) | No | Yes | No |
| B-10 | Per-user push preferences | OPTIONAL | No | Yes | Maybe |
| B-11 | Promotional push admin tool | OPTIONAL | No | Yes | No |
| B-12 | Serve/transform seeded images consistently (API static `/images` or CDN) | RECOMMENDED | No | Yes | No |
| B-13 | Migrate seed `/images/*` URLs to absolute | RECOMMENDED | No (URLs resolve for web too — but verify `resolveAssetUrl` passthrough: absolute passes through ✅) | Yes | Data backfill |
| — | Keep `details` for whitelisted error codes in prod | RECOMMENDED | No (looser, not stricter) | Yes | No |
| — | Fix cart summary/items consistency | RECOMMENDED | Fixes web bug too | Yes | No |

**Everything else stays untouched.** The existing backend is consumed as-is.

---

# IMPLEMENTATION ROADMAP (suggested order)

| Sprint | Deliverable |
|---|---|
| 0 | Backend: B-3 (webhook), B-8 (device tokens) + tests; ops: Razorpay webhook URL configured |
| 1 | App skeleton: flavors/config, theme (Phase 16 tokens), go_router shell, Dio+envelope, secure store, cookie/auth interceptors, splash/session bootstrap, unit test base |
| 2 | Auth screens + session flow; Home (`/content/home`); Categories; Image resolver + Shimmer |
| 3 | Shop list + filters (sheet/rail), Product detail + variants + reviews, Search |
| 4 | Cart (+guest identity/merge verification), Wishlist, Coupons |
| 5 | Address book, Checkout (settings-driven), COD end-to-end |
| 6 | Payments: Razorpay session + pending-intent resume + status screen; Order confirmation |
| 7 | Orders list/detail, reviews write, profile, notifications center, support pages |
| 8 | Push (B-8 integration), deep links, tablet two-pane pass, performance pass |
| 9 | Integration tests, hardening (429/backoff, offline banner), store submission |

**Definition of done:** all 20 phases' acceptance points covered; backend + web suites green; integration suite green on dev; no secrets in repo; store-ready builds.
