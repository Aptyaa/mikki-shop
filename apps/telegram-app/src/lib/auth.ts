import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthSession, AuthUser } from "@mikki-shop/shared-types";

/**
 * Сессия покупателя.
 *
 * Токен персистится: `initData` под рукой не всегда (в браузере его нет вовсе),
 * а каждый холодный старт Mini App ходить за новым токеном — лишний запрос на
 * пути к первому экрану.
 *
 * Гость — нормальное состояние, а не ошибка: каталог, карточка и корзина
 * публичные, вход нужен только заказу.
 */
interface AuthState {
  token: string | null;
  /** Миллисекунды эпохи. `null` — токена нет. */
  expiresAt: number | null;
  user: AuthUser | null;
  signIn: (session: AuthSession) => void;
  signOut: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      expiresAt: null,
      user: null,

      signIn: (session) =>
        set({ token: session.token, expiresAt: session.expiresAt, user: session.user }),

      signOut: () => set({ token: null, expiresAt: null, user: null }),
    }),
    { name: "mikki-auth", version: 1 },
  ),
);

/**
 * Токен для заголовка `Authorization`, если он ещё годен.
 *
 * Срок проверяется на клиенте с запасом: истёкший токен всё равно даст 401,
 * но сходить за новым до запроса дешевле, чем получить отказ на оформлении
 * заказа. Настоящая проверка — на бэкенде, эта только бережёт лишний круг.
 */
const EXPIRY_MARGIN_MS = 60_000;

export function bearerToken(): string | null {
  const { token, expiresAt } = useAuth.getState();
  if (!token) return null;
  if (expiresAt != null && expiresAt - EXPIRY_MARGIN_MS < Date.now()) return null;
  return token;
}
