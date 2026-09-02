import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // .env лежит в корне монорепо, а не в папке приложения — без этого
  // VITE_API_URL молча оказался бы undefined, и фронт стучался бы сам в себя.
  envDir: "../../",
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
});
