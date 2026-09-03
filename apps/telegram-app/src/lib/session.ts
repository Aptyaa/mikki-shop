import { useEffect, useRef } from "react";
import { login } from "../api/catalog";
import { bearerToken, useAuth } from "./auth";
import { inTelegram, initData, initDataUserId, start } from "./telegram";

/**
 * Вход при старте приложения.
 *
 * Молчаливый: экрана логина нет и не будет — Telegram уже знает, кто это.
 * Гость — нормальный исход, а не ошибка: каталог, карточка и корзина работают
 * без входа, он понадобится только заказу.
 */
export function useSession(): void {
  const signIn = useAuth((state) => state.signIn);
  const signOut = useAuth((state) => state.signOut);
  // Токен в зависимостях не ради чтения, а ради перезапуска: клиент сбрасывает
  // сессию на 401, и вход должен случиться заново сам, без перезагрузки.
  const token = useAuth((state) => state.token);
  const storedId = useAuth((state) => state.user?.telegramId);

  // Сброс чужой сессии — ровно один раз за жизнь приложения. Иначе сервер,
  // вернувший не тот аккаунт, загнал бы вход в бесконечный круг
  // «сбросили — вошли — опять не тот — сбросили».
  const dropped = useRef(false);

  useEffect(() => {
    start();

    if (!inTelegram()) return;
    const data = initData();
    if (!data) return;

    // Хранилище Mini App общее для всех аккаунтов одного клиента, а токен
    // живёт месяц: после переключения аккаунта сохранённая сессия — чужая.
    const currentId = initDataUserId();
    if (!dropped.current && token && storedId && currentId && storedId !== currentId) {
      dropped.current = true;
      signOut();
      return;
    }

    // Живой токен своего аккаунта есть — второй раз за ним не ходим.
    if (bearerToken() !== null) return;

    const controller = new AbortController();
    login(data, controller.signal)
      .then(signIn)
      .catch(() => {
        // Молча: вход не состоялся, приложение остаётся гостевым. Повторной
        // попытки здесь нет намеренно — эффект перезапускается по изменению
        // токена, а он остался пустым, так что цикла не будет. Сказать о
        // неудаче будет что на экране оформления заказа, там это и мешает.
      });

    return () => controller.abort();
  }, [signIn, signOut, token, storedId]);
}
