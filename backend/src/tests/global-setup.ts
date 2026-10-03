import { execSync } from "node:child_process";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/cuddlehug_test?schema=public";

/**
 * Runs migrations and the seed against the isolated test database before the
 * suite starts. The seed truncates first, so this is idempotent.
 */
export default function globalSetup(): void {
  const env = { ...process.env, DATABASE_URL: TEST_DB_URL, NODE_ENV: "test" };
  execSync("npx prisma migrate deploy", { cwd: process.cwd(), env, stdio: "inherit" });
  execSync("npx tsx prisma/seed.ts", { cwd: process.cwd(), env, stdio: "inherit" });
}
