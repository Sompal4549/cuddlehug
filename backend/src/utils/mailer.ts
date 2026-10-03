import { env, resendConfigured } from "../config/env";
import { logger } from "./logger";

type SendEmailOptions = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

/**
 * Transactional email helper.
 * Uses Resend when RESEND_API_KEY is configured, otherwise logs the message so
 * development never blocks on missing credentials.
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  if (!resendConfigured) {
    logger.info(`[email:skipped] to=${String(options.to)} subject="${options.subject}"`);
    return;
  }
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(env.RESEND_API_KEY);
    await resend.emails.send({
      from: env.EMAIL_FROM,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    logger.info(`[email:sent] to=${String(options.to)} subject="${options.subject}"`);
  } catch (error) {
    logger.error("Failed to send email", error instanceof Error ? error.message : error);
  }
}

const wrap = (title: string, body: string) => `
  <div style="font-family:Georgia,serif;background:#fff9f4;padding:32px;color:#26180f">
    <h1 style="color:#e4685c;margin:0 0 16px">CuddleHug</h1>
    <h2 style="margin:0 0 12px">${title}</h2>
    <p style="line-height:1.6;color:#4a382d">${body}</p>
    <p style="margin-top:32px;color:#8a7566;font-size:12px">More Happiness. More Hugs.</p>
  </div>`;

export const emails = {
  passwordReset: (to: string, resetUrl: string) =>
    sendEmail({
      to,
      subject: "Reset your CuddleHug password",
      html: wrap(
        "Reset your password",
        `Click the link below to choose a new password. The link is valid for 30 minutes.<br/><br/>
         <a href="${resetUrl}" style="background:#e4685c;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Reset password</a>
         <br/><br/>If you did not request this, you can safely ignore this email.`,
      ),
      text: `Reset your CuddleHug password: ${resetUrl}`,
    }),

  orderConfirmation: (to: string, orderNumber: string, total: string) =>
    sendEmail({
      to,
      subject: `Order confirmed - ${orderNumber}`,
      html: wrap(
        "Order Confirmed!",
        `Thanks for shopping with CuddleHug. Your order <strong>${orderNumber}</strong> of <strong>₹${total}</strong> is confirmed and will be packed shortly.`,
      ),
    }),

  paymentConfirmation: (to: string, orderNumber: string, amount: string) =>
    sendEmail({
      to,
      subject: `Payment received - ${orderNumber}`,
      html: wrap(
        "Payment received",
        `We received your payment of <strong>₹${amount}</strong> for order <strong>${orderNumber}</strong>.`,
      ),
    }),

  orderStatus: (to: string, orderNumber: string, status: string, tracking?: string | null) =>
    sendEmail({
      to,
      subject: `Order ${status.toLowerCase()} - ${orderNumber}`,
      html: wrap(
        `Order ${status}`,
        `Your order <strong>${orderNumber}</strong> is now <strong>${status}</strong>.${
          tracking ? `<br/>Tracking number: <strong>${tracking}</strong>` : ""
        }`,
      ),
    }),
};
