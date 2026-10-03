import { Router } from "express";
import { addressController, deviceController, notificationController, profileController } from "../controllers/account.controller";
import { requireAuth } from "../middleware/auth";
import { categoryService } from "../services/category.service";
import { productService } from "../services/product.service";
import { getSettings, publicSettings } from "../services/settings.service";
import { asyncHandler } from "../utils/asyncHandler";
import { success } from "../utils/response";

export const addressRouter = Router();
export const notificationRouter = Router();
export const profileRouter = Router();
export const settingsRouter = Router();
export const miscRouter = Router();
export const deviceRouter = Router();

// Push device registration (FCM) for the mobile clients.
deviceRouter.use(requireAuth);
deviceRouter.post("/register", deviceController.register);
deviceRouter.post("/unregister", deviceController.unregister);

addressRouter.use(requireAuth);
addressRouter.get("/", addressController.list);
addressRouter.post("/", addressController.create);
addressRouter.patch("/:id", addressController.update);
addressRouter.delete("/:id", addressController.remove);
addressRouter.post("/:id/default", addressController.setDefault);

notificationRouter.use(requireAuth);
notificationRouter.get("/", notificationController.list);
notificationRouter.get("/unread-count", notificationController.unreadCount);
notificationRouter.post("/read-all", notificationController.markAllRead);
notificationRouter.post("/:id/read", notificationController.markRead);

profileRouter.use(requireAuth);
profileRouter.get("/", profileController.get);
profileRouter.patch("/", profileController.update);
profileRouter.patch("/password", profileController.changePassword);

// Public store configuration used by the storefront (tax, shipping, status).
settingsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    success(res, publicSettings(await getSettings()));
  }),
);

miscRouter.get(
  "/health",
  asyncHandler(async (_req, res) => {
    success(res, { status: "ok", service: "cuddlehug-api", time: new Date().toISOString() });
  }),
);

/** Everything the storefront homepage needs in a single round trip. */
miscRouter.get(
  "/content/home",
  asyncHandler(async (_req, res) => {
    const [settings, categories, featured, bestSellers, newArrivals] = await Promise.all([
      getSettings(),
      categoryService.listPublic(),
      productService.featured(8),
      productService.bestSellers(8),
      productService.newArrivals(8),
    ]);
    success(res, {
      settings: publicSettings(settings),
      categories,
      featured,
      bestSellers,
      newArrivals,
      hero: [
        { image: "/images/01_home_hero_teddy.jpg", alt: "CuddleHug teddy bears collection" },
        { image: "/images/14_shop_white_giant_teddy.jpg", alt: "Giant teddy bears" },
        { image: "/images/13_shop_pink_teddy.jpg", alt: "Pink teddy bears" },
      ],
    });
  }),
);
