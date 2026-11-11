import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    // Unit tests only. Nothing here may reach the network or a database:
    // there is one shared Neon database and it is production.
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    environment: "node",
  },
});
