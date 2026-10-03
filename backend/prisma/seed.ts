import { PrismaClient, Role, OrderStatus, PaymentStatus, PaymentMethod, ReviewStatus, ProductSize, ProductColor, NotificationType, InventoryTransactionType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const IMG = (name: string) => `/images/${name}`;

type SeedVariant = {
  size: ProductSize;
  color: ProductColor;
  sku: string;
  mrp: string;
  price: string;
  stock: number;
};

type SeedProduct = {
  name: string;
  slug: string;
  sku: string;
  categorySlug: string;
  shortDescription: string;
  description: string;
  mrp: string;
  price: string;
  discountPercent: number;
  material: string;
  filling: string;
  weightGrams: number;
  careInstructions: string;
  ageRecommendation: string;
  tags: string[];
  isFeatured: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  images: string[];
  variants: SeedVariant[];
};

const CATEGORIES = [
  {
    name: "Classic",
    slug: "classic",
    description: "Timeless teddy bears with that forever-hug feel.",
    image: IMG("02_category_classic.jpg"),
    sortOrder: 1,
  },
  {
    name: "Giant",
    slug: "giant",
    description: "Oversized cuddle buddies for big, soft embraces.",
    image: IMG("03_category_giant.jpg"),
    sortOrder: 2,
  },
  {
    name: "Mini",
    slug: "mini",
    description: "Pocket-sized pals that travel everywhere with you.",
    image: IMG("04_category_mini.jpg"),
    sortOrder: 3,
  },
  {
    name: "Couple",
    slug: "couple",
    description: "Matching bears made for gifting to your favourite person.",
    image: IMG("05_category_couple.jpg"),
    sortOrder: 4,
  },
  {
    name: "Fluffy",
    slug: "fluffy",
    description: "Extra-plush fur bears that are impossibly soft.",
    image: IMG("06_category_fluffy.jpg"),
    sortOrder: 5,
  },
  {
    name: "Heart Bears",
    slug: "heart-bears",
    description: "Love-filled bears holding a heart, made for celebrations.",
    image: IMG("07_category_heart_bears.jpg"),
    sortOrder: 6,
  },
];

const v = (
  size: ProductSize,
  color: ProductColor,
  sku: string,
  mrp: string,
  price: string,
  stock: number,
): SeedVariant => ({ size, color, sku, mrp, price, stock });

const PRODUCTS: SeedProduct[] = [
  {
    name: "Barnaby the Classic Teddy Bear",
    slug: "barnaby-classic-teddy-bear",
    sku: "CH-CLS-101",
    categorySlug: "classic",
    shortDescription: "Our signature honey-brown teddy with hand-stitched paws and a velvet nose.",
    description:
      "Barnaby is the bear that started it all. Cut from ultra-soft honey-brown plush, filled with recycled fibre and finished with hand-stitched paw pads, a embroidered muzzle and a satin ribbon around the neck. Perfectly sized for bedtime hugs, sofa cuddles and thoughtful gifting.",
    mrp: "2499.00",
    price: "1799.00",
    discountPercent: 28,
    material: "Premium soft plush (100% polyester)",
    filling: "Hypoallergenic recycled fibre fill",
    weightGrams: 640,
    careInstructions: "Machine wash gentle, cold water. Air dry flat. Do not bleach.",
    ageRecommendation: "Suitable for ages 3+",
    tags: ["teddy bear", "classic", "brown", "gift", "bestseller"],
    isFeatured: true,
    isBestSeller: true,
    isNewArrival: false,
    images: [IMG("08_product_brown_teddy.jpg"), IMG("12_shop_brown_teddy.jpg"), IMG("16_product_detail_main_teddy.jpg")],
    variants: [
      v("SMALL", "BROWN", "CH-CLS-101-S-BR", "1799.00", "1299.00", 40),
      v("MEDIUM", "BROWN", "CH-CLS-101-M-BR", "2499.00", "1799.00", 60),
      v("LARGE", "BROWN", "CH-CLS-101-L-BR", "3299.00", "2399.00", 25),
    ],
  },
  {
    name: "Rosie the Blush Pink Teddy",
    slug: "rosie-blush-pink-teddy",
    sku: "CH-CLS-102",
    categorySlug: "classic",
    shortDescription: "A rosy-pink classic bear with a bow and the softest cheeks.",
    description:
      "Rosie is wrapped in blush-pink velour with cream paw pads and a neatly tied grosgrain bow. Her gently weighted bottom lets her sit upright on shelves, beds and desks - always ready for a cuddle.",
    mrp: "2299.00",
    price: "1649.00",
    discountPercent: 28,
    material: "Blush velour plush",
    filling: "Hypoallergenic recycled fibre fill",
    weightGrams: 580,
    careInstructions: "Hand wash or machine wash gentle cycle. Air dry.",
    ageRecommendation: "Suitable for ages 3+",
    tags: ["teddy bear", "pink", "classic", "gift for her"],
    isFeatured: true,
    isBestSeller: false,
    isNewArrival: true,
    images: [IMG("09_product_pink_teddy.jpg"), IMG("13_shop_pink_teddy.jpg")],
    variants: [
      v("SMALL", "PINK", "CH-CLS-102-S-PK", "1599.00", "1149.00", 35),
      v("MEDIUM", "PINK", "CH-CLS-102-M-PK", "2299.00", "1649.00", 45),
    ],
  },
  {
    name: "Snowdrop White Classic Teddy",
    slug: "snowdrop-white-classic-teddy",
    sku: "CH-CLS-103",
    categorySlug: "classic",
    shortDescription: "Crisp white plush with chocolate details for a premium look.",
    description:
      "Snowdrop pairs snow-white plush with rich chocolate-brown stitching, giving her a clean, premium silhouette. Her fur resists matting, so she stays photo-ready long after the gift is unwrapped.",
    mrp: "2599.00",
    price: "1899.00",
    discountPercent: 27,
    material: "Anti-matting crystal plush",
    filling: "Hypoallergenic recycled fibre fill",
    weightGrams: 610,
    careInstructions: "Machine wash gentle, cold water. Air dry flat.",
    ageRecommendation: "Suitable for ages 3+",
    tags: ["teddy bear", "white", "premium", "classic"],
    isFeatured: false,
    isBestSeller: true,
    isNewArrival: false,
    images: [IMG("10_product_white_teddy.jpg"), IMG("23_admin_product_thumb_2.jpg")],
    variants: [
      v("MEDIUM", "WHITE", "CH-CLS-103-M-WH", "2599.00", "1899.00", 30),
      v("LARGE", "CREAM", "CH-CLS-103-L-CR", "3499.00", "2599.00", 18),
    ],
  },
  {
    name: "Caramel Hugger Teddy",
    slug: "caramel-hugger-teddy",
    sku: "CH-CLS-104",
    categorySlug: "classic",
    shortDescription: "Warm caramel fur, long limbs and a seriously huggable tummy.",
    description:
      "With extra-long arms and a squishy tummy, Caramel Hugger was designed for full-body hugs. The golden-caramel fur has a subtle sheen that catches the light beautifully in photos.",
    mrp: "2799.00",
    price: "2099.00",
    discountPercent: 25,
    material: "Sheen plush with velour accents",
    filling: "Hypoallergenic recycled fibre fill",
    weightGrams: 720,
    careInstructions: "Machine wash gentle, cold water. Air dry flat.",
    ageRecommendation: "Suitable for ages 3+",
    tags: ["teddy bear", "caramel", "huggable", "classic"],
    isFeatured: false,
    isBestSeller: false,
    isNewArrival: true,
    images: [IMG("12_shop_brown_teddy.jpg"), IMG("08_product_brown_teddy.jpg")],
    variants: [
      v("MEDIUM", "BROWN", "CH-CLS-104-M-BR", "2799.00", "2099.00", 28),
      v("LARGE", "BROWN", "CH-CLS-104-L-BR", "3599.00", "2749.00", 14),
    ],
  },
  {
    name: "Goliath 4ft Giant Teddy Bear",
    slug: "goliath-4ft-giant-teddy-bear",
    sku: "CH-GNT-201",
    categorySlug: "giant",
    shortDescription: "A four-foot statement bear for proposals, birthdays and big apologies.",
    description:
      "Goliath stands at a full four feet of cloud-soft plush. He arrives in a gift box with a ribbon and a handwritten-style card. The kind of bear that makes an entrance and stays in the living room forever.",
    mrp: "8999.00",
    price: "6999.00",
    discountPercent: 22,
    material: "High-density giant plush",
    filling: "Premium fibre fill with EPS beads for stability",
    weightGrams: 4200,
    careInstructions: "Spot clean. Professional wash recommended for giant sizes.",
    ageRecommendation: "Suitable for ages 3+",
    tags: ["giant teddy", "4ft", "gift", "statement"],
    isFeatured: true,
    isBestSeller: true,
    isNewArrival: false,
    images: [IMG("14_shop_white_giant_teddy.jpg"), IMG("16_product_detail_main_teddy.jpg")],
    variants: [
      v("GIANT", "WHITE", "CH-GNT-201-G-WH", "8999.00", "6999.00", 12),
      v("GIANT", "BROWN", "CH-GNT-201-G-BR", "9499.00", "7499.00", 8),
    ],
  },
  {
    name: "Hugsy 3ft Giant Teddy",
    slug: "hugsy-3ft-giant-teddy",
    sku: "CH-GNT-202",
    categorySlug: "giant",
    shortDescription: "Three feet of caramel-brown fluff with a friendly permanent smile.",
    description:
      "Hugsy is our three-foot crowd favourite: broad shoulders, a hand-embroidered smile and caramel fur that stays soft after washing. Big enough to lean on, light enough to carry upstairs.",
    mrp: "6999.00",
    price: "5499.00",
    discountPercent: 21,
    material: "High-density giant plush",
    filling: "Premium fibre fill with EPS beads for stability",
    weightGrams: 3100,
    careInstructions: "Spot clean. Professional wash recommended.",
    ageRecommendation: "Suitable for ages 3+",
    tags: ["giant teddy", "3ft", "brown", "gift"],
    isFeatured: false,
    isBestSeller: false,
    isNewArrival: true,
    images: [IMG("16_product_detail_main_teddy.jpg"), IMG("12_shop_brown_teddy.jpg")],
    variants: [
      v("GIANT", "BROWN", "CH-GNT-202-G-BR", "6999.00", "5499.00", 10),
      v("LARGE", "CREAM", "CH-GNT-202-L-CR", "4999.00", "3999.00", 16),
    ],
  },
  {
    name: "Pocket Pals Mini Teddy Set of 2",
    slug: "pocket-pals-mini-teddy-set",
    sku: "CH-MNI-301",
    categorySlug: "mini",
    shortDescription: "Two 8-inch mini bears - one for you, one for your favourite person.",
    description:
      "Pocket Pals come as a pair: a brown and a pink eight-inch bear, each with a tiny ribbon and a loop for backpacks. Small enough for goody bags, sweet enough to keep.",
    mrp: "999.00",
    price: "749.00",
    discountPercent: 25,
    material: "Soft short-pile plush",
    filling: "Hypoallergenic recycled fibre fill",
    weightGrams: 160,
    careInstructions: "Machine wash gentle, cold water. Air dry flat.",
    ageRecommendation: "Suitable for ages 3+",
    tags: ["mini teddy", "set", "stocking filler", "kids"],
    isFeatured: true,
    isBestSeller: true,
    isNewArrival: false,
    images: [IMG("11_product_mini_teddy.jpg"), IMG("19_cart_mini_teddy.jpg")],
    variants: [
      v("MINI", "BROWN", "CH-MNI-301-MINI-BR", "999.00", "749.00", 80),
      v("MINI", "PINK", "CH-MNI-301-MINI-PK", "999.00", "749.00", 65),
    ],
  },
  {
    name: "Tiny Bean Mini Teddy",
    slug: "tiny-bean-mini-teddy",
    sku: "CH-MNI-302",
    categorySlug: "mini",
    shortDescription: "A bean-bag mini bear that sits perfectly on your desk.",
    description:
      "Tiny Bean is weighted with soft pellets so he sits upright anywhere - desk, shelf, dashboard. At six inches he is the little reminder that somebody is thinking of you.",
    mrp: "699.00",
    price: "549.00",
    discountPercent: 21,
    material: "Short-pile plush with pellet weighting",
    filling: "Fibre fill + poly pellets",
    weightGrams: 95,
    careInstructions: "Spot clean only.",
    ageRecommendation: "Suitable for ages 3+",
    tags: ["mini teddy", "desk", "cute", "small gift"],
    isFeatured: false,
    isBestSeller: false,
    isNewArrival: true,
    images: [IMG("19_cart_mini_teddy.jpg"), IMG("11_product_mini_teddy.jpg")],
    variants: [v("MINI", "CREAM", "CH-MNI-302-MINI-CR", "699.00", "549.00", 90)],
  },
  {
    name: "Teddy Couple Gift Set",
    slug: "teddy-couple-gift-set",
    sku: "CH-CPL-401",
    categorySlug: "couple",
    shortDescription: "Matching brown and cream bears, boxed together for two.",
    description:
      "Our Couple Set pairs a caramel bear with a cream bear, both wearing complementary satin ribbons. They arrive together in a windowed gift box - ready for anniversaries, engagements and just-because days.",
    mrp: "3999.00",
    price: "3199.00",
    discountPercent: 20,
    material: "Premium soft plush",
    filling: "Hypoallergenic recycled fibre fill",
    weightGrams: 1150,
    careInstructions: "Machine wash gentle, cold water. Air dry flat.",
    ageRecommendation: "Suitable for ages 3+",
    tags: ["couple", "gift set", "anniversary", "matching"],
    isFeatured: true,
    isBestSeller: false,
    isNewArrival: false,
    images: [IMG("15_shop_couple_teddy.jpg"), IMG("24_admin_product_thumb_3.jpg")],
    variants: [
      v("MEDIUM", "BROWN", "CH-CPL-401-M-BR", "3999.00", "3199.00", 20),
      v("LARGE", "CREAM", "CH-CPL-401-L-CR", "4799.00", "3899.00", 12),
    ],
  },
  {
    name: "His & Hers Heart Bear Duo",
    slug: "his-and-hers-heart-bear-duo",
    sku: "CH-CPL-402",
    categorySlug: "couple",
    shortDescription: "Two bears, two hearts - one red, one blush.",
    description:
      "Each bear in this duo holds a plush heart: one red, one blush pink. Embroidered initials are optional at checkout, making this the personalised gift that always lands.",
    mrp: "4499.00",
    price: "3599.00",
    discountPercent: 20,
    material: "Soft plush with felt heart detail",
    filling: "Hypoallergenic recycled fibre fill",
    weightGrams: 1220,
    careInstructions: "Machine wash gentle, cold water. Air dry flat.",
    ageRecommendation: "Suitable for ages 3+",
    tags: ["couple", "heart", "valentine", "personalised"],
    isFeatured: false,
    isBestSeller: true,
    isNewArrival: false,
    images: [IMG("25_admin_product_thumb_4.jpg"), IMG("15_shop_couple_teddy.jpg")],
    variants: [v("MEDIUM", "RED", "CH-CPL-402-M-RD", "4499.00", "3599.00", 15)],
  },
  {
    name: "Cloud Fluffy Teddy Bear",
    slug: "cloud-fluffy-teddy-bear",
    sku: "CH-FLF-501",
    categorySlug: "fluffy",
    shortDescription: "Long-pile cloud fur that is impossibly soft to the touch.",
    description:
      "Cloud uses a 40mm long-pile fur that feels like holding a warm cloud. The fur is treated to stay tangle-free and the bear is stitched with reinforced seams for years of cuddles.",
    mrp: "3299.00",
    price: "2499.00",
    discountPercent: 24,
    material: "40mm long-pile cloud fur",
    filling: "Hypoallergenic recycled fibre fill",
    weightGrams: 780,
    careInstructions: "Hand wash cold. Shake out fur while damp and air dry.",
    ageRecommendation: "Suitable for ages 3+",
    tags: ["fluffy", "soft", "long fur", "premium"],
    isFeatured: true,
    isBestSeller: true,
    isNewArrival: false,
    images: [IMG("13_shop_pink_teddy.jpg"), IMG("09_product_pink_teddy.jpg")],
    variants: [
      v("MEDIUM", "PINK", "CH-FLF-501-M-PK", "3299.00", "2499.00", 26),
      v("LARGE", "WHITE", "CH-FLF-501-L-WH", "4199.00", "3299.00", 15),
    ],
  },
  {
    name: "Marshmallow Fluffy Teddy",
    slug: "marshmallow-fluffy-teddy",
    sku: "CH-FLF-502",
    categorySlug: "fluffy",
    shortDescription: "Cream-coloured fluff with a marshmallow-soft tummy.",
    description:
      "Marshmallow combines cream long-pile fur with a shorter, silkier tummy panel that is extra soft against the skin. A gentle weight and floppy limbs make him the ultimate lap bear.",
    mrp: "3499.00",
    price: "2699.00",
    discountPercent: 23,
    material: "Long-pile fur with silky velour tummy",
    filling: "Hypoallergenic recycled fibre fill",
    weightGrams: 840,
    careInstructions: "Hand wash cold. Air dry flat.",
    ageRecommendation: "Suitable for ages 3+",
    tags: ["fluffy", "cream", "lap bear", "soft"],
    isFeatured: false,
    isBestSeller: false,
    isNewArrival: true,
    images: [IMG("24_admin_product_thumb_3.jpg"), IMG("10_product_white_teddy.jpg")],
    variants: [v("MEDIUM", "CREAM", "CH-FLF-502-M-CR", "3499.00", "2699.00", 22)],
  },
  {
    name: "Sweetheart Teddy with Love Heart",
    slug: "sweetheart-teddy-with-love-heart",
    sku: "CH-HRT-601",
    categorySlug: "heart-bears",
    shortDescription: "Classic brown bear hugging a stitched 'love you' heart.",
    description:
      "Sweetheart clutches a plush heart embroidered with 'love you' in script. His paws are stitched in a permanent hug pose, making him the sweetest way to say something you cannot quite put into words.",
    mrp: "2899.00",
    price: "2199.00",
    discountPercent: 24,
    material: "Soft plush with satin heart",
    filling: "Hypoallergenic recycled fibre fill",
    weightGrams: 690,
    careInstructions: "Machine wash gentle, cold water. Air dry flat.",
    ageRecommendation: "Suitable for ages 3+",
    tags: ["heart bear", "love", "valentine", "gift"],
    isFeatured: true,
    isBestSeller: false,
    isNewArrival: false,
    images: [IMG("17_cart_brown_teddy.jpg"), IMG("08_product_brown_teddy.jpg")],
    variants: [
      v("MEDIUM", "BROWN", "CH-HRT-601-M-BR", "2899.00", "2199.00", 32),
      v("LARGE", "BROWN", "CH-HRT-601-L-BR", "3699.00", "2899.00", 17),
    ],
  },
  {
    name: "Ruby Red Heart Bear",
    slug: "ruby-red-heart-bear",
    sku: "CH-HRT-602",
    categorySlug: "heart-bears",
    shortDescription: "A rich ruby-red bear holding a cream heart - pure celebration.",
    description:
      "Ruby is dyed a deep, even red that never bleeds, with a cream heart stitched across her tummy. She is the bear people choose for proposals, anniversaries and milestone birthdays.",
    mrp: "3099.00",
    price: "2399.00",
    discountPercent: 23,
    material: "Colourfast soft plush",
    filling: "Hypoallergenic recycled fibre fill",
    weightGrams: 710,
    careInstructions: "Hand wash cold to preserve colour. Air dry flat.",
    ageRecommendation: "Suitable for ages 3+",
    tags: ["heart bear", "red", "anniversary", "romantic"],
    isFeatured: false,
    isBestSeller: true,
    isNewArrival: true,
    images: [IMG("18_cart_pink_teddy.jpg"), IMG("25_admin_product_thumb_4.jpg")],
    variants: [v("MEDIUM", "RED", "CH-HRT-602-M-RD", "3099.00", "2399.00", 24)],
  },
];

async function clearDatabase() {
  const tables = [
    "CouponUsage", "CouponProduct", "CouponVariant", "Coupon",
    "Review", "Notification", "AuditLog", "OrderStatusHistory", "OrderItem", "Payment", "Order",
    "InventoryTransaction", "Inventory", "Cart", "CartItem", "WishlistItem", "Wishlist",
    "ProductImage", "ProductVariant", "Product", "Category",
    "Address", "PasswordResetToken", "RefreshToken", "User",
    "SiteSetting", "Counter",
  ];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
  }
}

async function main() {
  console.log("Seeding CuddleHug database...");
  await clearDatabase();

  const passwordHash = await bcrypt.hash("Admin@1234", 12);
  const customerHash = await bcrypt.hash("Customer@1234", 12);
  const friendHash = await bcrypt.hash("Friend@1234", 12);

  const admin = await prisma.user.create({
    data: {
      email: "admin@cuddlehug.com",
      passwordHash,
      firstName: "Aditi",
      lastName: "Sharma",
      phone: "+91 98765 43210",
      role: Role.ADMIN,
      emailVerified: true,
    },
  });

  const customer = await prisma.user.create({
    data: {
      email: "customer@cuddlehug.com",
      passwordHash: customerHash,
      firstName: "Rohan",
      lastName: "Verma",
      phone: "+91 91234 56780",
      role: Role.CUSTOMER,
      emailVerified: true,
      wishlist: { create: {} },
    },
  });

  const friend = await prisma.user.create({
    data: {
      email: "meera@example.com",
      passwordHash: friendHash,
      firstName: "Meera",
      lastName: "Iyer",
      phone: "+91 99887 76655",
      role: Role.CUSTOMER,
      emailVerified: true,
      wishlist: { create: {} },
    },
  });

  const address = await prisma.address.create({
    data: {
      userId: customer.id,
      label: "Home",
      fullName: "Rohan Verma",
      phone: "+91 91234 56780",
      line1: "14, Maple Residency, 3rd Cross",
      line2: "Indiranagar",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560038",
      country: "India",
      isDefault: true,
    },
  });

  await prisma.address.create({
    data: {
      userId: customer.id,
      label: "Office",
      fullName: "Rohan Verma",
      phone: "+91 91234 56780",
      line1: "Prestige Tech Park, Tower B, Level 6",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560103",
      country: "India",
      isDefault: false,
    },
  });

  const categoryMap = new Map<string, string>();
  for (const category of CATEGORIES) {
    const created = await prisma.category.create({ data: category });
    categoryMap.set(category.slug, created.id);
  }

  const productMap = new Map<string, string>();
  const variantMap = new Map<string, { id: string; productId: string; price: string; name: string; sku: string; size: string; color: string; slug: string }>();

  for (const product of PRODUCTS) {
    const categoryId = categoryMap.get(product.categorySlug)!;
    const created = await prisma.product.create({
      data: {
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        categoryId,
        shortDescription: product.shortDescription,
        description: product.description,
        mrp: product.mrp,
        price: product.price,
        discountPercent: product.discountPercent,
        status: "ACTIVE",
        material: product.material,
        filling: product.filling,
        weightGrams: product.weightGrams,
        careInstructions: product.careInstructions,
        ageRecommendation: product.ageRecommendation,
        tags: product.tags,
        isFeatured: product.isFeatured,
        isBestSeller: product.isBestSeller,
        isNewArrival: product.isNewArrival,
        lowStockThreshold: 5,
        images: {
          create: product.images.map((url, index) => ({
            url,
            alt: `${product.name} - image ${index + 1}`,
            position: index,
            isPrimary: index === 0,
          })),
        },
        variants: {
          create: product.variants.map((variant) => ({
            size: variant.size,
            color: variant.color,
            sku: variant.sku,
            mrp: variant.mrp,
            price: variant.price,
            isActive: true,
            inventory: {
              create: { quantity: variant.stock, reserved: 0, lowStockThreshold: 5 },
            },
          })),
        },
      },
      include: { variants: { include: { inventory: true } } },
    });

    productMap.set(product.slug, created.id);
    for (const variant of created.variants) {
      variantMap.set(variant.sku, {
        id: variant.id,
        productId: created.id,
        price: variant.price.toString(),
        name: product.name,
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        slug: product.slug,
      });
      await prisma.inventoryTransaction.create({
        data: {
          variantId: variant.id,
          type: InventoryTransactionType.STOCK_ADDED,
          quantity: variant.inventory!.quantity,
          delta: variant.inventory!.quantity,
          note: "Initial stock from seed",
          actorId: admin.id,
        },
      });
    }
  }

  // ---- coupons ---------------------------------------------------------
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86400000);
  const started = new Date(now.getTime() - 7 * 86400000);

  await prisma.coupon.create({
    data: {
      code: "CUDDLE10",
      description: "10% off on orders above ₹999",
      type: "PERCENTAGE",
      value: "10",
      minOrderAmount: "999.00",
      startsAt: started,
      endsAt: in30,
      usageLimit: 500,
      perUserLimit: 2,
      active: true,
    },
  });
  await prisma.coupon.create({
    data: {
      code: "HUGS20",
      description: "20% off (up to ₹500) on orders above ₹2499",
      type: "PERCENTAGE",
      value: "20",
      minOrderAmount: "2499.00",
      maxDiscount: "500.00",
      startsAt: started,
      endsAt: in30,
      usageLimit: 200,
      perUserLimit: 1,
      active: true,
    },
  });
  await prisma.coupon.create({
    data: {
      code: "BEAR50",
      description: "Flat ₹500 off on orders above ₹3999",
      type: "FIXED",
      value: "500",
      minOrderAmount: "3999.00",
      startsAt: started,
      endsAt: in30,
      usageLimit: 100,
      perUserLimit: 1,
      active: true,
    },
  });
  await prisma.coupon.create({
    data: {
      code: "EXPIRED25",
      description: "Expired seasonal offer",
      type: "PERCENTAGE",
      value: "25",
      minOrderAmount: "0",
      startsAt: new Date(now.getTime() - 90 * 86400000),
      endsAt: new Date(now.getTime() - 30 * 86400000),
      active: false,
      perUserLimit: 1,
    },
  });

  // ---- orders ----------------------------------------------------------
  const brownMedium = variantMap.get("CH-CLS-101-M-BR")!;
  const pinkMedium = variantMap.get("CH-CLS-102-M-PK")!;
  const miniSet = variantMap.get("CH-MNI-301-MINI-BR")!;
  const giantWhite = variantMap.get("CH-GNT-201-G-WH")!;
  const sweetheart = variantMap.get("CH-HRT-601-M-BR")!;
  const fluffy = variantMap.get("CH-FLF-501-M-PK")!;

  type SeedOrder = {
    number: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    method: PaymentMethod;
    lines: { variant: typeof brownMedium; qty: number }[];
    daysAgo: number;
    tracking?: string;
  };

  const seedOrders: SeedOrder[] = [
    { number: "CH-2026-000001", status: OrderStatus.DELIVERED, paymentStatus: PaymentStatus.PAID, method: PaymentMethod.RAZORPAY, lines: [{ variant: brownMedium, qty: 1 }, { variant: miniSet, qty: 1 }], daysAgo: 26, tracking: "IN4829105733" },
    { number: "CH-2026-000002", status: OrderStatus.SHIPPED, paymentStatus: PaymentStatus.PAID, method: PaymentMethod.RAZORPAY, lines: [{ variant: giantWhite, qty: 1 }], daysAgo: 4, tracking: "IN7712049582" },
    { number: "CH-2026-000003", status: OrderStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID, method: PaymentMethod.COD, lines: [{ variant: sweetheart, qty: 2 }], daysAgo: 2 },
    { number: "CH-2026-000004", status: OrderStatus.PENDING, paymentStatus: PaymentStatus.PENDING, method: PaymentMethod.RAZORPAY, lines: [{ variant: fluffy, qty: 1 }], daysAgo: 0 },
    { number: "CH-2026-000005", status: OrderStatus.CANCELLED, paymentStatus: PaymentStatus.REFUNDED, method: PaymentMethod.RAZORPAY, lines: [{ variant: pinkMedium, qty: 1 }], daysAgo: 12 },
    { number: "CH-2026-000006", status: OrderStatus.DELIVERED, paymentStatus: PaymentStatus.PAID, method: PaymentMethod.RAZORPAY, lines: [{ variant: pinkMedium, qty: 1 }, { variant: miniSet, qty: 2 }], daysAgo: 40, tracking: "IN3390887711" },
  ];

  let reservedUnits = 0;

  for (const [index, order] of seedOrders.entries()) {
    const placedAt = new Date(now.getTime() - order.daysAgo * 86400000);
    const subtotalMinor = order.lines.reduce((acc, line) => {
      const [whole, frac = "0"] = line.variant.price.split(".");
      return acc + (Number(whole) * 100 + Number(frac.slice(0, 2).padEnd(2, "0"))) * line.qty;
    }, 0);
    const subtotal = (subtotalMinor / 100).toFixed(2);
    const shipping = Number(subtotal) >= 1499 ? 0 : 79;
    const tax = Number(((Number(subtotal) * 0.18).toFixed(2)));
    const total = (Number(subtotal) + shipping + tax).toFixed(2);

    const orderRecord = await prisma.order.create({
      data: {
        orderNumber: order.number,
        userId: index % 3 === 2 ? friend.id : customer.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.method,
        subtotal,
        discountAmount: "0.00",
        shippingAmount: shipping.toFixed(2),
        taxAmount: tax.toFixed(2),
        totalAmount: total,
        shippingAddress: JSON.parse(JSON.stringify(address)) as never,
        trackingNumber: order.tracking ?? null,
        courierName: order.tracking ? "Delhivery" : null,
        estimatedDelivery: new Date(placedAt.getTime() + 5 * 86400000),
        placedAt,
        paidAt: order.paymentStatus === PaymentStatus.PAID ? placedAt : null,
        cancelReason: order.status === OrderStatus.CANCELLED ? "Changed my mind" : null,
        items: {
          create: order.lines.map((line) => ({
            productId: line.variant.productId,
            variantId: line.variant.id,
            productName: line.variant.name,
            productSlug: line.variant.slug,
            variantLabel: `${line.variant.size} / ${line.variant.color}`,
            sku: line.variant.sku,
            imageUrl: null,
            unitPrice: line.variant.price,
            mrp: line.variant.price,
            quantity: line.qty,
            lineTotal: ((Number(line.variant.price) * line.qty)).toFixed(2),
          })),
        },
        history: {
          create: [
            { status: OrderStatus.PENDING, note: "Order placed", createdAt: placedAt },
            ...(order.status !== OrderStatus.PENDING
              ? [{ status: OrderStatus.CONFIRMED, note: "Payment confirmed", createdAt: new Date(placedAt.getTime() + 60000) }]
              : []),
            ...(order.status === OrderStatus.SHIPPED
              ? [{ status: OrderStatus.SHIPPED, note: "Handed to Delhivery", createdAt: new Date(placedAt.getTime() + 86400000) }]
              : []),
            ...(order.status === OrderStatus.DELIVERED
              ? [{ status: OrderStatus.DELIVERED, note: "Delivered", createdAt: new Date(placedAt.getTime() + 3 * 86400000) }]
              : []),
            ...(order.status === OrderStatus.CANCELLED
              ? [{ status: OrderStatus.CANCELLED, note: "Cancelled by customer", createdAt: new Date(placedAt.getTime() + 3600000) }]
              : []),
          ],
        },
        payment: {
          create: {
            amount: total,
            provider: order.method === PaymentMethod.RAZORPAY ? "RAZORPAY" : "MANUAL",
            providerOrderId: order.paymentStatus === PaymentStatus.PAID && order.method === PaymentMethod.RAZORPAY ? `order_seed_${index + 1}` : null,
            providerPaymentId: order.paymentStatus === PaymentStatus.PAID && order.method === PaymentMethod.RAZORPAY ? `pay_seed_${index + 1}` : null,
            status: order.paymentStatus,
            method: order.method === PaymentMethod.COD ? "cod" : "card",
          },
        },
      },
    });

    // Inventory accounting mirrors the real flow.
    for (const line of order.lines) {
      const inventory = await prisma.inventory.findUnique({ where: { variantId: line.variant.id } });
      if (!inventory) continue;
      if (order.status === OrderStatus.PENDING) {
        await prisma.inventory.update({
          where: { variantId: line.variant.id },
          data: { reserved: inventory.reserved + line.qty },
        });
        await prisma.inventoryTransaction.create({
          data: {
            variantId: line.variant.id,
            type: InventoryTransactionType.ORDER_RESERVATION,
            quantity: line.qty,
            delta: 0,
            referenceId: orderRecord.id,
            note: `Reserved for ${order.number}`,
            actorId: customer.id,
          },
        });
        reservedUnits += line.qty;
      } else if (order.status !== OrderStatus.CANCELLED) {
        await prisma.inventory.update({
          where: { variantId: line.variant.id },
          data: { quantity: Math.max(0, inventory.quantity - line.qty) },
        });
        await prisma.inventoryTransaction.create({
          data: {
            variantId: line.variant.id,
            type: InventoryTransactionType.STOCK_REMOVED,
            quantity: line.qty,
            delta: -line.qty,
            referenceId: orderRecord.id,
            note: `Fulfilled for ${order.number}`,
            actorId: admin.id,
          },
        });
      }
    }
  }

  void reservedUnits;

  // ---- reviews ---------------------------------------------------------
  const reviews: { sku: string; user: string; rating: number; title: string; comment: string; status: ReviewStatus }[] = [
    { sku: "CH-CLS-101-M-BR", user: customer.id, rating: 5, title: "Exactly like the photo", comment: "Barnaby is even softer than I expected and the stitching is flawless. My daughter refuses to put him down.", status: ReviewStatus.APPROVED },
    { sku: "CH-CLS-102-M-PK", user: friend.id, rating: 4, title: "Lovely colour", comment: "The blush pink is spot on and he sits upright nicely. Docked one star only because delivery took an extra day.", status: ReviewStatus.APPROVED },
    { sku: "CH-MNI-301-MINI-BR", user: customer.id, rating: 5, title: "Perfect little pair", comment: "Bought the pocket pals for a goody bag and kept one for myself. Great quality for the price.", status: ReviewStatus.APPROVED },
    { sku: "CH-GNT-201-G-WH", user: friend.id, rating: 5, title: "A showstopper", comment: "Four feet of bear and genuinely huggable. It arrived boxed and spotless. Everyone at the party loved it.", status: ReviewStatus.APPROVED },
    { sku: "CH-HRT-601-M-BR", user: customer.id, rating: 4, title: "Sweet and well made", comment: "The embroidered heart is a lovely touch. Fur is soft after a wash too.", status: ReviewStatus.APPROVED },
    { sku: "CH-FLF-501-M-PK", user: friend.id, rating: 5, title: "Insanely soft", comment: "The long fur is unreal - like holding a warm cloud. Worth every rupee.", status: ReviewStatus.PENDING },
  ];

  for (const review of reviews) {
    const variant = variantMap.get(review.sku)!;
    const order = await prisma.order.findFirst({
      where: { userId: review.user, items: { some: { productId: variant.productId } } },
      select: { id: true },
    });
    await prisma.review.create({
      data: {
        productId: variant.productId,
        userId: review.user,
        orderId: order?.id ?? null,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        status: review.status,
      },
    });
  }

  // Recompute product ratings from approved reviews.
  const allProducts = await prisma.product.findMany({ select: { id: true } });
  for (const product of allProducts) {
    const agg = await prisma.review.aggregate({
      where: { productId: product.id, status: ReviewStatus.APPROVED },
      _avg: { rating: true },
      _count: true,
    });
    const rating = Number((agg._avg.rating ?? 0).toFixed(2));
    await prisma.product.update({
      where: { id: product.id },
      data: {
        ratingAverage: rating.toFixed(2),
        ratingCount: agg._count,
        soldCount: await prisma.orderItem.count({ where: { productId: product.id } }) * 7 + Math.floor(rating * 4),
      },
    });
  }

  // ---- notifications ---------------------------------------------------
  const notifications: { userId: string; type: NotificationType; title: string; body: string }[] = [
    { userId: customer.id, type: NotificationType.ORDER_CONFIRMATION, title: "Order CH-2026-000004 is confirmed", body: "We are preparing your fluffy pink bear for dispatch." },
    { userId: customer.id, type: NotificationType.SHIPPING, title: "Your order is on the way", body: "Order CH-2026-000002 has been handed to Delhivery." },
    { userId: customer.id, type: NotificationType.DELIVERY, title: "Order delivered", body: "Order CH-2026-000001 was delivered. Hope it brings a big smile!" },
    { userId: customer.id, type: NotificationType.GENERAL, title: "Coupon CUDDLE10 is live", body: "Get 10% off orders above ₹999 for a limited time." },
  ];
  for (const notification of notifications) {
    await prisma.notification.create({ data: notification });
  }

  // ---- settings --------------------------------------------------------
  const settings: Record<string, unknown> = {
    "store.name": "CuddleHug",
    "store.tagline": "More Happiness. More Hugs.",
    "store.logo": "/images/logo.svg",
    "store.status": "open",
    "store.currency": "INR",
    "tax.enabled": true,
    "tax.rate": 18,
    "shipping.fee": 79,
    "shipping.freeThreshold": 1499,
    "shipping.codEnabled": true,
    "contact.email": "hello@cuddlehug.com",
    "contact.phone": "+91 98765 43210",
    "contact.address": "CuddleHug Studios, Indiranagar, Bengaluru, Karnataka, India",
    "social.instagram": "https://instagram.com/cuddlehug",
    "social.facebook": "https://facebook.com/cuddlehug",
    "social.twitter": "https://x.com/cuddlehug",
    "social.youtube": "https://youtube.com/@cuddlehug",
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.siteSetting.upsert({
      where: { key },
      create: { key, value: value as never },
      update: { value: value as never },
    });
  }

  await prisma.counter.upsert({ where: { key: "order" }, create: { key: "order", value: 6 }, update: {} });

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "seed.run",
      entity: "Database",
      meta: { products: PRODUCTS.length, categories: CATEGORIES.length } as never,
    },
  });

  const counts = {
    users: await prisma.user.count(),
    categories: await prisma.category.count(),
    products: await prisma.product.count(),
    variants: await prisma.productVariant.count(),
    orders: await prisma.order.count(),
    reviews: await prisma.review.count(),
    coupons: await prisma.coupon.count(),
  };
  console.table(counts);
  console.log("Seed complete.");
  console.log("Admin   -> admin@cuddlehug.com / Admin@1234");
  console.log("Customer-> customer@cuddlehug.com / Customer@1234");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
