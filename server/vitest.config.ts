import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The API tests share one database and some mutate global state (e.g. the Lab 3 test that deactivates every
    // other Admin), so files run one after another to stay deterministic.
    fileParallelism: false,
  },
});
