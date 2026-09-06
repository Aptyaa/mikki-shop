import type { ReactNode } from "react";

/**
 * Слой экрана.
 *
 * Прячется `visibility`, а не `display: none`: у скрытого через `display`
 * элемента браузер выбрасывает бокс прокрутки, и экран возвращался бы к
 * началу. `position: fixed` при этом убирает его из потока, чтобы верхний
 * экран занимал вьюпорт целиком.
 *
 * Скрытый через `visibility` слой выпадает и из дерева доступности: кнопки
 * оставшегося смонтированным экрана не найдёт ни палец, ни скринридер. Раньше
 * здесь же жил контекст «виден ли экран» — он был нужен шапке, пока она
 * занимала нативную кнопку «назад» Telegram, то есть место ВНЕ своего слоя,
 * которое `visibility` не прячет. Кнопку мы больше не занимаем, и контекст
 * ушёл вместе с ней.
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
  return <div style={hidden ? HIDDEN : undefined}>{children}</div>;
}
