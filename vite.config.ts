import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api/liferouter": "http://127.0.0.1:8091" } },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: "student-accounts", test: /node_modules\/@supabase\// }],
        },
      },
    },
  },
});
