import { fileURLToPath } from "node:url";

// Config en objet simple (pas d'import "vitest/config") pour rester exécutable
// via `npx vitest` sans vitest installé dans node_modules du projet.
export default {
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
};
