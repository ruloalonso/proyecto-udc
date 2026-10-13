import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // Babylon por módulos (E2-9): el paquete entero pesa ~6 MB.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@babylonjs/core",
              message:
                "Importa cada pieza de su módulo (@babylonjs/core/Maths/math.vector.js…); los que solo se enganchan, en render/babylonModules.ts.",
            },
          ],
        },
      ],
    },
  },
);
