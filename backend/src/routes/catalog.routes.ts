import { Router } from "express";
import { categoryController, productController, reviewController } from "../controllers/catalog.controller";
import { attachUser, requireAdmin, requireAuth } from "../middleware/auth";

export const productRouter = Router();
export const categoryRouter = Router();
export const reviewRouter = Router();

// ---- public catalogue ---------------------------------------------------
productRouter.get("/", attachUser, productController.list);
productRouter.get("/featured", productController.featured);
productRouter.get("/best-sellers", productController.bestSellers);
productRouter.get("/new-arrivals", productController.newArrivals);
productRouter.get("/:slug/related", productController.related);
productRouter.get("/:slug", productController.getBySlug);

// ---- admin catalogue ----------------------------------------------------
productRouter.get("/id/:id", requireAdmin, productController.adminGet);
productRouter.post("/", requireAdmin, productController.create);
productRouter.patch("/:id", requireAdmin, productController.update);
productRouter.delete("/:id", requireAdmin, productController.remove);
productRouter.patch("/:id/status", requireAdmin, productController.toggleStatus);

categoryRouter.get("/", categoryController.listPublic);
categoryRouter.get("/admin/all", requireAdmin, categoryController.listAdmin);
categoryRouter.get("/:slug", categoryController.getBySlug);
categoryRouter.post("/", requireAdmin, categoryController.create);
categoryRouter.patch("/:id", requireAdmin, categoryController.update);
categoryRouter.delete("/:id", requireAdmin, categoryController.remove);
categoryRouter.post("/reorder", requireAdmin, categoryController.reorder);

// ---- reviews ------------------------------------------------------------
reviewRouter.get("/product/:productId", reviewController.listForProduct);
reviewRouter.get("/mine", requireAuth, reviewController.listMine);
reviewRouter.post("/", requireAuth, reviewController.create);
reviewRouter.get("/admin/all", requireAdmin, reviewController.adminList);
reviewRouter.patch("/:id", requireAdmin, reviewController.moderate);
reviewRouter.delete("/:id", requireAdmin, reviewController.remove);
