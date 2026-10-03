import { Router } from "express";
import { paymentService } from "../services/payment.service";
import { asyncHandler } from "../utils/asyncHandler";
import { success } from "../utils/response";

export const webhookRouter = Router();

/**
 * Razorpay webhook. Mounted in app.ts behind express.raw() so the HMAC is
 * computed over the exact bytes Razorpay signed — express.json() must not
 * re-serialise the body.
 */
webhookRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
    const signature = req.header("x-razorpay-signature");
    const result = await paymentService.handleWebhook({ rawBody, signature });
    success(res, result);
  }),
);
