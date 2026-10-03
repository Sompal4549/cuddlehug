import { Router } from "express";
import { authRouter } from "./auth.routes";
import { categoryRouter, productRouter, reviewRouter } from "./catalog.routes";
import { cartRouter, orderRouter, paymentRouter, wishlistRouter } from "./commerce.routes";
import { addressRouter, deviceRouter, miscRouter, notificationRouter, profileRouter, settingsRouter } from "./account.routes";
import { adminRouter } from "./admin.routes";
import { attachUser } from "../middleware/auth";

export const apiRouter = Router();

apiRouter.use(attachUser);

apiRouter.use("/", miscRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/products", productRouter);
apiRouter.use("/categories", categoryRouter);
apiRouter.use("/reviews", reviewRouter);
apiRouter.use("/cart", cartRouter);
apiRouter.use("/wishlist", wishlistRouter);
apiRouter.use("/orders", orderRouter);
apiRouter.use("/payments", paymentRouter);
apiRouter.use("/addresses", addressRouter);
apiRouter.use("/devices", deviceRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/profile", profileRouter);
apiRouter.use("/settings", settingsRouter);
apiRouter.use("/admin", adminRouter);
