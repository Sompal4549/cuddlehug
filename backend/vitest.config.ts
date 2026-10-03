import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 120000,
    pool: "forks",
    // Integration tests share one database, so run them one file at a time.
    fileParallelism: false,
    globalSetup: ["./src/tests/global-setup.ts"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/cuddlehug_test?schema=public",
      // Lets the webhook signature tests run while dev payment mode stays on
      // (RAZORPAY keys deliberately remain unset in tests).
      RAZORPAY_WEBHOOK_SECRET: "test_webhook_secret",
    },
  },
});
