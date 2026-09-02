import type { ReactNode } from "react";
import { AppBar, Logo } from "@mikki-shop/ui";

interface ScreenBarProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
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
export function ScreenBar({ title, subtitle, right }: ScreenBarProps) {
  return (
    <AppBar
      title={title}
      subtitle={subtitle}
      right={right}
      // Абсолютное центрирование, а не третья колонка флекса: иначе знак
      // съезжал бы вслед за длиной заголовка и набором кнопок справа.
      left={
        <Logo
          variant="mark"
          size="sm"
          style={{ position: "absolute", left: "50%", top: "50%",
            transform: "translate(-50%, -50%)", pointerEvents: "none" }}
        />
      }
    />
  );
}
