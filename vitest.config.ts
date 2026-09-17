import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    // Só a pasta de testes: `evolution/db` pertence ao Postgres do container
    // e a varredura padrão quebra com "permission denied".
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "evolution/**"],
    fileParallelism: false,
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // ver tests/server-only-stub.ts
      "server-only": path.resolve(__dirname, "tests/server-only-stub.ts"),
    },
  },
});
