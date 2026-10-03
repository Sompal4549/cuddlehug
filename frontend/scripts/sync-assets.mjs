#!/usr/bin/env node
/**
 * Syncs design assets from `src/assets` into `public/images` so that every
 * image is available at a stable URL (needed for DB-seeded product/category
 * images and for <Image src="/images/...">). Runs automatically before
 * `npm run dev` and `npm run build`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.resolve(__dirname, "../src/assets");
const TARGET = path.resolve(__dirname, "../public/images");
const EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".svg"];

if (!fs.existsSync(SOURCE)) {
  console.warn("[sync-assets] src/assets not found, skipping");
  process.exit(0);
}

fs.mkdirSync(TARGET, { recursive: true });

const files = fs.readdirSync(SOURCE).filter((file) => EXTENSIONS.includes(path.extname(file).toLowerCase()));
let copied = 0;

for (const file of files) {
  const from = path.join(SOURCE, file);
  const to = path.join(TARGET, file);
  const fromStat = fs.statSync(from);
  const needsCopy = !fs.existsSync(to) || fs.statSync(to).mtimeMs < fromStat.mtimeMs;
  if (needsCopy) {
    fs.copyFileSync(from, to);
    copied += 1;
  }
}

console.log(`[sync-assets] ${files.length} asset(s) in src/assets, ${copied} newly copied to public/images`);
