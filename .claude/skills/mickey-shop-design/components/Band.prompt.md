Full-bleed yellow strip — **the brand's main use of colour.** Instead of tinting panels and cards all over
a screen, colour is spent in two or three wide bands that cut the page.

```jsx
<Band><span>Доставка от 3 000 ₽</span><span>бесплатно</span></Band>
<Band tone="ink" align="center">Обмен 14 дней</Band>
```

**Intentional addition** (no source defined it) — it is what carries the "paper and ink" direction: the
alternative was tinted cards everywhere, which is what made the first build look like a template.

At most **two bands per screen**. Never put body copy in one — a band holds a label, a number, or a promise
of six words. `bleed` assumes the parent has `--gutter` padding.
