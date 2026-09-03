import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Тесты лежат рядом с кодом, который проверяют: `catalog.service.ts` и
    // `catalog.service.test.ts` в одной папке. Отдельного дерева `test/` нет —
    // при переезде модуля тест едет вместе с ним и не теряется.
    include: ["apps/*/src/**/*.test.ts", "packages/*/src/**/*.test.ts"],
    // Всё, что здесь проверяется, — чистая логика: ни БД, ни DOM. Поэтому один
    // общий прогон на всё монорепо, без разбиения на проекты и без jsdom.
    environment: "node",
  },
});
