Product list row — **the default way to show a catalogue.** Reach for `ProductCard` only when the
photograph is the point (a promoted collection, a cross-sell carousel).

```jsx
<div>
  {items.map((p,i)=>
    <ProductRow key={p.id} {...p} meta="меринос · XS–M · осталось 4" marked
      last={i===items.length-1} onClick={()=>open(p.id)}/>)}
</div>
```

Why a list beats a grid here: pet apparel is bought on **fit**, and a row has space for the sizing line that
decides the purchase. A two-up grid has room for a name and a price and nothing else.

The row's price is `stacked align="right"` so the numbers form a clean right column down the page. Rules are
hairlines; the last row drops its rule so the list ends without a dangling line.
