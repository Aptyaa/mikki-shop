Product tile. **No box** — no fill, no border, no shadow, no padding. The photograph is the tile; the
page background runs behind the text. Two per row at mini-app width.

```jsx
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",
  columnGap:"var(--grid-gap)",rowGap:"var(--grid-gap-row)"}}>
  <ProductCard title="Вязаный свитер «Сахарок»" price={1490} was={2190} tag="−30%" sizes="XS · S · M" />
</div>
```

Photos are 4:5 — taller than square, which gives the grid vertical rhythm and room to breathe. Titles clamp
at two lines and the tile reserves both, so a row never goes ragged. One tag maximum.

Hover darkens the photograph very slightly. It does **not** lift: nothing in this system rises off the page
just because a pointer is near it.
