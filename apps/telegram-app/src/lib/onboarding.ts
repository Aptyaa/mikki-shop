/**
 * Свёрнут ли блок «как это работает» на стартовом экране.
 *
 * Не Zustand, в отличие от корзины и сессии: критерий из `ARCHITECTURE.md` —
 * стор заводится, когда состояние нужно больше чем одному экрану. Здесь оно
 * нужно ровно одному, но обязано пережить перезагрузку — значит хватает
 * `localStorage` и `useState` того экрана, которому оно принадлежит.
 *
 * Хранится «свёрнут», а не «показан»: по умолчанию (ключа нет) блок раскрыт,
 * и первый вход видит объяснение, не спрашивая ничего у хранилища.
 */
const KEY = "mikki-intro-collapsed";

/**
 * Чтение и запись обёрнуты в `try`: в приватном режиме Safari обращение к
 * `localStorage` бросает исключение, и стартовый экран падал бы белым просто
 * потому, что не смог вспомнить состояние одной секции.
 */
export function introCollapsed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberIntroCollapsed(collapsed: boolean): void {
  try {
    if (collapsed) window.localStorage.setItem(KEY, "1");
    else window.localStorage.removeItem(KEY);
  } catch {
    // Не вспомнит — покажет раскрытым в следующий раз. Это не повод падать.
  }
}
