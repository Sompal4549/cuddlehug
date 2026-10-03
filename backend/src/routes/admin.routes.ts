import { Router } from "express";
import type { RequestHandler } from "express";
import { adminController, uploadSingle } from "../controllers/admin.controller";
import { orderController } from "../controllers/commerce.controller";
import { categoryController, productController, reviewController } from "../controllers/catalog.controller";
import { requireAdmin } from "../middleware/auth";

export const adminRouter = Router();

adminRouter.use(requireAdmin);

/** Admin catalogue listings include DRAFT/ARCHIVED products. */
const adminList: RequestHandler = (req, _res, next) => {
  req.query.admin = "true";
  next();
};

// dashboard
adminRouter.get("/dashboard", adminController.dashboard);

// products
adminRouter.get("/products", adminList, productController.list);
adminRouter.post("/products", productController.create);
adminRouter.get("/products/:id", productController.adminGet);
adminRouter.patch("/products/:id", productController.update);
adminRouter.delete("/products/:id", productController.remove);
adminRouter.patch("/products/:id/status", productController.toggleStatus);

// categories
adminRouter.get("/categories", categoryController.listAdmin);
adminRouter.post("/categories", categoryController.create);
adminRouter.patch("/categories/:id", categoryController.update);
adminRouter.delete("/categories/:id", categoryController.remove);
adminRouter.post("/categories/reorder", categoryController.reorder);

// orders
adminRouter.get("/orders", orderController.listAdmin);
adminRouter.get("/orders/:id", orderController.adminGet);
adminRouter.patch("/orders/:id/status", orderController.updateStatus);

// customers
adminRouter.get("/customers", adminController.customers);
adminRouter.patch("/customers/:id/status", adminController.setCustomerStatus);

// inventory
adminRouter.get("/inventory", adminController.inventory);
adminRouter.get("/inventory/transactions", adminController.inventoryTransactions);
adminRouter.post("/inventory/adjust", adminController.adjustInventory);

// coupons
adminRouter.get("/coupons", adminController.coupons);
adminRouter.post("/coupons", adminController.createCoupon);
adminRouter.patch("/coupons/:id", adminController.updateCoupon);
adminRouter.delete("/coupons/:id", adminController.deleteCoupon);

// reviews moderation
adminRouter.get("/reviews", reviewController.adminList);
adminRouter.patch("/reviews/:id", reviewController.moderate);
adminRouter.delete("/reviews/:id", reviewController.remove);

// reports
adminRouter.get("/reports/sales", adminController.reportSales);
adminRouter.get("/reports/orders", adminController.reportOrders);
adminRouter.get("/reports/products", adminController.reportProducts);
adminRouter.get("/reports/inventory", adminController.reportInventory);
adminRouter.get("/reports/customers", adminController.reportCustomers);
adminRouter.get("/reports/coupons", adminController.reportCoupons);
adminRouter.get("/reports/revenue", adminController.reportRevenue);

// settings
adminRouter.get("/settings", adminController.getSettings);
adminRouter.put("/settings", adminController.updateSettings);

// audit logs
adminRouter.get("/audit-logs", adminController.auditLogs);

// uploads (Cloudinary, local disk fallback)
adminRouter.post("/uploads", uploadSingle, adminController.uploadImage);
adminRouter.post("/uploads/delete", adminController.deleteUpload);
