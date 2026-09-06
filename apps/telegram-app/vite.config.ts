import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Пустой префикс — чтобы прочесть и не-VITE переменные корневого .env.
  // Нужен PORT: API слушает его, а не общепринятый 3000 (см. 002 про занятые
  // порты). Захардкоженный порт в прокси разошёлся бы с .env молча — дев-сервер
  // поднялся бы, а каталог отвечал бы 502 на машине с другим портом.
  // В бандл отсюда ничего не утекает: клиенту видны только VITE_*.
  const env = loadEnv(mode, "../../", "");
  const apiTarget = env.DEV_API_TARGET ?? `http://127.0.0.1:${env.PORT || "3001"}`;

  return {
    plugins: [react()],
    // .env лежит в корне монорепо, а не в папке приложения — без этого
    // VITE_API_URL молча оказался бы undefined, и фронт стучался бы сам в себя.
    envDir: "../../",
    server: {
      host: "127.0.0.1",
      port: 5173,
      // Тот же путь, что и в проде (nginx проксирует /api на NestJS): фронт
      // всегда ходит на свой origin, а не на отдельный хост API. Иначе дев и
      // прод расходятся ровно в том месте, которое ломается только в клиенте
      // Telegram, — на mixed content.
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          // У NestJS нет глобального префикса — ручки лежат в корне.
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
      // Дев-сервер отвергает незнакомый Host («Blocked request. This host is
      // not allowed») — защита от DNS rebinding. Домены туннелей в белом списке,
      // чтобы этот шаг не упирался в неё. Одного списка мало: дев-сборку наружу
      // отдают через `--host 0.0.0.0`, а HMR под туннелем требует своего
      // `server.hmr` (иначе клиент стучится в wss://<хост-туннеля>:5173).
      // Штатный путь наружу — собранный фронт за nginx, см. docker-compose.
      allowedHosts: [".trycloudflare.com", ".ngrok-free.app", ".ngrok.app"],
    },
  };
});
