import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { cloudinaryConfigured, env } from "../config/env";
import { AppError } from "../utils/errors";
import { logger } from "../utils/logger";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "image/svg+xml"];
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function ensureDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function extensionFor(mimetype: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/avif": ".avif",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
  };
  return map[mimetype] ?? ".bin";
}

/**
 * Uploads an image to Cloudinary when credentials are present, otherwise
 * falls back to local disk storage (development). Never stores binaries in
 * PostgreSQL.
 */
export async function uploadImage(
  file: { buffer: Buffer; mimetype: string; originalname: string },
  options?: { folder?: string },
): Promise<{ url: string; publicId: string; provider: "cloudinary" | "local" }> {
  if (!ALLOWED.includes(file.mimetype)) {
    throw AppError.badRequest("Only image files are allowed (jpeg, png, webp, avif, gif, svg)");
  }
  if (file.buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw AppError.badRequest("Image must be smaller than 5MB");
  }

  const folder = options?.folder ?? "cuddlehug/products";

  if (cloudinaryConfigured) {
    try {
      const { v2: cloudinary } = await import("cloudinary");
      cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET,
      });
      const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder, resource_type: "image" },
          (error, res) => {
            if (error || !res) reject(error ?? new Error("Empty Cloudinary response"));
            else resolve(res as { secure_url: string; public_id: string });
          },
        );
        stream.end(file.buffer);
      });
      return { url: result.secure_url, publicId: result.public_id, provider: "cloudinary" };
    } catch (error) {
      logger.error("Cloudinary upload failed, falling back to local storage", error);
    }
  }

  ensureDir();
  const name = `${Date.now()}_${crypto.randomBytes(6).toString("hex")}${extensionFor(file.mimetype)}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), file.buffer);
  return { url: `/uploads/${name}`, publicId: name, provider: "local" };
}

export async function deleteImage(url: string): Promise<void> {
  if (url.startsWith("http") && cloudinaryConfigured) {
    try {
      const { v2: cloudinary } = await import("cloudinary");
      cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET,
      });
      const withoutExt = url.replace(/\.[a-z0-9]+$/i, "");
      const publicId = withoutExt.split("/").slice(-2).join("/");
      await cloudinary.uploader.destroy(publicId);
      return;
    } catch (error) {
      logger.error("Cloudinary delete failed", error);
      return;
    }
  }

  if (url.startsWith("/uploads/")) {
    ensureDir();
    const filePath = path.join(UPLOAD_DIR, path.basename(url));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}
