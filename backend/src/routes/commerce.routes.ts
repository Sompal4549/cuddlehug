import { Router } from "express";
import { cartController, orderController, paymentController, wishlistController } from "../controllers/commerce.controller";
import { attachUser, requireAuth } from "../middleware/auth";

export const cartRouter = Router();
export const wishlistRouter = Router();
export const orderRouter = Router();
export const paymentRouter = Router();

// ---- cart (guest or signed in) -----------------------------------------
cartRouter.use(attachUser);
cartRouter.get("/", cartController.get);
cartRouter.post("/items", cartController.add);
cartRouter.patch("/items", cartController.update);
cartRouter.delete("/items/:itemId", cartController.remove);
cartRouter.post("/coupon", cartController.applyCoupon);
cartRouter.delete("/coupon", cartController.removeCoupon);

// ---- wishlist (auth required) -------------------------------------------
wishlistRouter.use(requireAuth);
wishlistRouter.get("/", wishlistController.list);
wishlistRouter.post("/", wishlistController.add);
wishlistRouter.get("/:productId/check", wishlistController.check);
wishlistRouter.delete("/:productId", wishlistController.remove);

// ---- orders -------------------------------------------------------------
orderRouter.get("/stats", requireAuth, orderController.stats);
orderRouter.get("/", requireAuth, orderController.listMine);
orderRouter.post("/", requireAuth, orderController.create);
orderRouter.get("/:id", requireAuth, orderController.getMine);

// ---- payments -----------------------------------------------------------
paymentRouter.use(requireAuth);
paymentRouter.post("/create-order", paymentController.createIntent);
paymentRouter.post("/verify", paymentController.verify);
paymentRouter.post("/dev-complete", paymentController.devComplete);
paymentRouter.get("/status", paymentController.status);
