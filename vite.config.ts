import { defineConfig, loadEnv } from "vite";
import { handleApi } from "./server/handler";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(env))
    if (!key.startsWith("VITE_") && process.env[key] === undefined)
      process.env[key] = value;
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "productlab-local-api",
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url?.startsWith("/api/")) void handleApi(req, res);
            else next();
          });
        },
      },
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (/\/(react|react-dom|scheduler)\//.test(id)) return "react";
              if (id.includes("lucide-react")) return "icons";
              if (
                /\/(recharts|recharts-scale|d3-[^/]+|react-smooth|decimal.js-light)\//.test(
                  id,
                )
              )
                return "charts";
              if (/\/(pdf-lib|@pdf-lib|fontkit)\//.test(id)) return "pdf";
            }
          },
        },
      },
    },
  };
});
