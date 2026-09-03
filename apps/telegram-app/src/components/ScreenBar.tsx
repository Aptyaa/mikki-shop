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
 * Шапка экрана: `AppBar` из кита плюс Микки посередине полосы.
 *
 * Маскот живёт здесь, а не в каждом экране: он один на всё приложение, и
 * добавлять его руками в новый экран — значит рано или поздно забыть.
 * Знак — прозрачный растр без диска и без вордмарка (`variant="mark"`):
 * на светлой полосе подложка ему не нужна, а имя магазина в шапке дублировало
 * бы заголовок экрана.
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

  return (
    <AppBar
      title={title}
      subtitle={subtitle}
      right={right}
      left={
        <>
          {onBack && !nativeBack && (
            <IconButton label="Назад" onClick={onBack}>
              <Icon name="chevron-left" />
            </IconButton>
          )}
          {/* Абсолютное центрирование, а не третья колонка флекса: иначе знак
              съезжал бы вслед за длиной заголовка и набором кнопок справа. */}
          <Logo
            variant="mark"
            size="sm"
            style={{ position: "absolute", left: "50%", top: "50%",
              transform: "translate(-50%, -50%)", pointerEvents: "none" }}
          />
        </>
      }
    />
  );
}
