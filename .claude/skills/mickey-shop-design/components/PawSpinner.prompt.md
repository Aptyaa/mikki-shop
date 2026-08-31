Loading indicator. **Never use a ring spinner in this brand** — the paw is the whole point.

```jsx
<PawSpinner size={20} />
<PawSpinner size={40} speed="1.4s" color="var(--action-primary)" />
```

It steps in 8 discrete frames rather than turning smoothly, so it reads as a paw walking round rather than a
wheel. `Button loading` and `MainButtonMock progress` use it automatically. Requires the Lucide script on the
page. For waits longer than ~1.5s, prefer `Skeleton` blocks that mirror the real layout and keep the paw for
button-level actions.
