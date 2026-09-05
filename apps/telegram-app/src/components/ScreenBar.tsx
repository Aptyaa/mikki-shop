import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AppBar, Icon, IconButton, Logo } from "@mikki-shop/ui";
import { attachNativeBack } from "../lib/telegram";
import { useScreenVisible } from "./ScreenLayer";

interface ScreenBarProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  /**
   * Кнопка «назад». Внутри Telegram уходит в нативную кнопку клиента, в
   * браузере рисуется своя. Две кнопки «назад» рядом — это не забота, а
   * вопрос «какая из них моя».
   */
  onBack?: () => void;
}

/**
 * Размеры мордочки в шапке.
 *
 * `HEAD_WIDTH` — ширина картинки до поворота. Меньше 22px брать нельзя:
 * дизайн-система запрещает опускать знак ниже 28px, потому что контуры
 * сливаются, а голова — самая крупная его часть, и на 22px она держится
 * ровно на этой границе.
 */
const HEAD_WIDTH = 22;
const HEAD_TILT = 45;

/**
 * Насколько повёрнутая голова торчит за края своего слоя, с каждой стороны.
 *
 * Поворот не меняет размер элемента в раскладке, но меняет то, что видно:
 * прямоугольник `w × h`, повёрнутый на 45°, занимает по горизонтали
 * `(w + h) · cos45`. Разница пополам и есть вылет.
 *
 * Отсюда же берётся сдвиг: чтобы видимый левый край мордочки совпал с началом
 * последней буквы, слой ставится правее её начала ровно на этот вылет.
 */
const HEAD_RATIO = 257 / 336; // пропорции файла mascot-head.png
const HEAD_OVERHANG =
  ((HEAD_WIDTH * (1 + HEAD_RATIO)) / Math.SQRT2 - HEAD_WIDTH) / 2;

/** Насколько мордочка приподнята над базовой линией строки. */
const HEAD_LIFT = 6;

/**
 * Заголовок с Микки, выглядывающим из-за последней буквы.
 *
 * Слово разрезается на «всё, кроме последней буквы» и саму букву, и голова
 * цепляется к букве, а не к слову целиком. Иначе один и тот же отступ давал бы
 * разную посадку на «Каталог» и «Профиль»: у слов разные последние буквы, и
 * считать пришлось бы от правого края всей строки.
 *
 * Мордочка лежит под текстом (`zIndex` у буквы выше) — она выглядывает из-за
 * надписи, а не лежит на ней.
 */
function TitleWithMascot({ title }: { title: string }) {
  const head = title.slice(-1);
  const rest = title.slice(0, -1);

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      {rest}
      <span style={{ position: "relative", display: "inline-block" }}>
        <Logo
          variant="head"
          style={{
            position: "absolute",
            zIndex: 0,
            width: HEAD_WIDTH,
            left: HEAD_OVERHANG,
            bottom: HEAD_LIFT,
            transform: `rotate(${HEAD_TILT}deg)`,
          }}
        />
        <span style={{ position: "relative", zIndex: 1 }}>{head}</span>
      </span>
    </span>
  );
}

/**
 * Шапка экрана: `AppBar` из кита плюс Микки у заголовка.
 *
 * Маскот живёт здесь, а не в каждом экране: он один на всё приложение, и
 * добавлять его руками в новый экран — значит рано или поздно забыть.
 *
 * Раньше знак стоял по центру полосы. Теперь голова цепляется к названию
 * раздела: маскот перестал быть отдельным предметом в шапке и стал частью
 * заголовка. На экранах без заголовка (карточка товара) знак остаётся по
 * центру — цепляться там не к чему, а терять маскота на целом экране незачем.
 */
export function ScreenBar({ title, subtitle, right, onBack }: ScreenBarProps) {
  const [nativeBack, setNativeBack] = useState(false);
  // Экран мог остаться смонтированным под другим: тогда кнопка не его.
  // Без этой проверки «назад» висела бы в каталоге после возврата из карточки.
  const visible = useScreenVisible();

  useEffect(() => {
    if (!onBack || !visible) return;

    const stop = attachNativeBack(onBack);
    // Кнопки нет — мы в браузере, рисуем свою.
    if (!stop) return;

    setNativeBack(true);
    return () => {
      stop();
      setNativeBack(false);
    };
  }, [onBack, visible]);

  // Голова цепляется только к обычной строке: разрезать на буквы можно её одну.
  const withMascot = typeof title === "string" && title.length > 0;

  return (
    <AppBar
      title={withMascot ? <TitleWithMascot title={title} /> : title}
      subtitle={subtitle}
      right={right}
      // Мордочка торчит за правый край заголовка, и обрезка многоточием её
      // срезала бы. Многоточие здесь не теряется: названия разделов короткие.
      titleOverflow={withMascot ? "visible" : "clip"}
      left={
        <>
          {onBack && !nativeBack && (
            <IconButton label="Назад" onClick={onBack}>
              <Icon name="chevron-left" />
            </IconButton>
          )}
          {/* Экран без заголовка — знак по центру, как было раньше:
              приткнуть голову не к чему, а шапка без маскота осиротела бы. */}
          {!withMascot && (
            <Logo
              variant="mark"
              size="sm"
              style={{ position: "absolute", left: "50%", top: "50%",
                transform: "translate(-50%, -50%)", pointerEvents: "none" }}
            />
          )}
        </>
      }
    />
  );
}
