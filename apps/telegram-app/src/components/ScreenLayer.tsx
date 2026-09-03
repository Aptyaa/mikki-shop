import { createContext, useContext } from "react";
import type { ReactNode } from "react";

/**
 * Виден ли экран прямо сейчас.
 *
 * Каталог и карточка не размонтируются, пока открыт экран поверх них, — иначе
 * возврат назад терял бы фильтры, подгруженные страницы и выбранный размер.
 * Но смонтированный экран не значит показанный, и всё, что он занимает вне
 * себя — нативная кнопка «назад» Telegram, — обязано это различать.
 */
const Visible = createContext(true);

export function useScreenVisible(): boolean {
  return useContext(Visible);
}

/**
 * Слой экрана.
 *
 * Прячется `visibility`, а не `display: none`: у скрытого через `display`
 * элемента браузер выбрасывает бокс прокрутки, и экран возвращался бы к
 * началу. `position: fixed` при этом убирает его из потока, чтобы верхний
 * экран занимал вьюпорт целиком.
 */
const HIDDEN = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  visibility: "hidden",
  pointerEvents: "none",
} as const;

export function ScreenLayer({ hidden, children }: { hidden: boolean; children: ReactNode }) {
  return (
    <Visible.Provider value={!hidden}>
      <div style={hidden ? HIDDEN : undefined}>{children}</div>
    </Visible.Provider>
  );
}
