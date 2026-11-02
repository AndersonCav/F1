import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";

export default defineConfig({
  base: "/F1/experience/",
  define: { __VUE_OPTIONS_API__: false, __VUE_PROD_DEVTOOLS__: false },
  plugins: [
    vue(),
    {
      name: "development-only-csp",
      apply: "serve",
      transformIndexHtml(html) {
        // Vite injects CSS during HMR. This transform never runs for production builds.
        return html
          .replace("style-src 'self';", "style-src 'self' 'unsafe-inline';")
          .replace(
            "connect-src 'self' https://api.jolpi.ca;",
            "connect-src 'self' https://api.jolpi.ca ws://127.0.0.1:5175;",
          );
      },
    },
  ],
  server: {
    port: 5175,
    strictPort: true,
    fs: { allow: [fileURLToPath(new URL("../", import.meta.url))] },
  },
  preview: { port: 4175, strictPort: true },
  build: {
    outDir: "dist-preview",
    manifest: true,
    target: "es2022",
    cssCodeSplit: true,
    assetsInlineLimit: 0,
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.js"],
    restoreMocks: true,
  },
});
