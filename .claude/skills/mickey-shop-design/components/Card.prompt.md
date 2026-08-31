Content surface. **Flat by default** — white fill, hairline border, no shadow.

```jsx
<Card pad="md">…</Card>
<Card tone="plain" pad="none">…</Card>       {/* group without drawing a box */}
<Card tone="tint" pad="md">…</Card>
<Card elevated pad="md">…</Card>             {/* only if it floats over content */}
```

A shadow means "this is above something". Sheets, popovers and controls over imagery get one; a card
sitting in the page flow does not. If a screen has more than one `elevated` surface, one of them is wrong.

Never nest `tone="card"` inside `tone="card"` — use `sunken` or `plain` for the inner block.
