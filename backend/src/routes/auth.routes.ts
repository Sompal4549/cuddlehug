import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";
import { authLimiter, sensitiveLimiter } from "../middleware/rateLimit";

export const authRouter = Router();

authRouter.post("/register", authLimiter, authController.register);
authRouter.post("/login", authLimiter, authController.login);
authRouter.post("/refresh", authController.refresh);
authRouter.post("/logout", authController.logout);
authRouter.get("/me", requireAuth, authController.me);
authRouter.post("/forgot-password", sensitiveLimiter, authController.forgotPassword);
authRouter.post("/reset-password", sensitiveLimiter, authController.resetPassword);
authRouter.patch("/password", authLimiter, requireAuth, authController.changePassword);
authRouter.patch("/profile", requireAuth, authController.updateProfile);
