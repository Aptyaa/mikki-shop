Pill button. One `primary` per screen; everything else steps down to `outline`/`ghost`.

```jsx
<Button variant="primary" size="lg" block iconLeft={<Icon name="shopping-bag"/>}>В корзину</Button>
```

In a Telegram Mini App the main purchase CTA belongs on Telegram's own MainButton, not here — use `size="lg" block` only for in-page actions above the reserved bottom strip. `soft` is for secondary actions sitting on cream. Press state is a 0.96 scale with the `--ease-wag` overshoot.
