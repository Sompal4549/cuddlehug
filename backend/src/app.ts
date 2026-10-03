import path from "node:path";
import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import { env, isProd } from "./config/env";
import { apiRouter } from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { apiLimiter } from "./middleware/rateLimit";
import { requestId, sessionMiddleware } from "./middleware/context";
import { webhookRouter } from "./routes/webhook.routes";

export function createApp(): Express {
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(
    helmet({
      // The API serves user-uploaded images in development mode.
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: false,
    }),
  );

  app.use(
    cors({
      origin: [
        env.FRONTEND_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
      ],
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id", "Idempotency-Key"],
    }),
  );

  app.use(compression());
  // Razorpay webhooks are signed over the exact raw bytes. Capture them for
  // this path before express.json() parses (and would re-serialise) the body;
  // body-parser marks the request as parsed, so later parsers skip it.
  app.use("/api/payments/webhook", express.raw({ type: "*/*", limit: "1mb" }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(cookieParser());
  app.use(requestId);
  app.use(sessionMiddleware);
  app.use(apiLimiter);

  // Locally uploaded images (Cloudinary disabled in development).
  app.use(
    "/uploads",
    express.static(path.resolve(process.cwd(), "uploads"), {
      maxAge: isProd ? "7d" : 0,
      fallthrough: true,
    }),
  );

  // Unauthenticated Razorpay callback — registered before the API router so it
  // never passes through attachUser/requireAuth.
  app.use("/api/payments/webhook", webhookRouter);

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
