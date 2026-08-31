Mock of Telegram's MainButton. **Intentional addition** — mockups need to show the native strip that real code cannot draw.

```jsx
<MainButtonMock text="ОФОРМИТЬ ЗАКАЗ · 2 980 ₽" />
```

Never restyle it into a pill: it must look like the platform's control, not ours. In production, drive the real API and pass `color: '#ED7B2F'`.
