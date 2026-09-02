import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import "@mikki-shop/ui/styles.css";
import "./index.css";

// Каталог меняется редко: минута свежести избавляет от повторного запроса при
// возврате на уже открытую категорию. Refetch по фокусу окна выключен —
// в Mini App окно теряет и получает фокус на каждом системном диалоге.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
