Product image slot. **Intentional addition** — the brand has no product photography yet, so every image
position is explicit and swappable.

```jsx
<PhotoSlot ratio="4 / 5" src="/assets/photos/sweater.jpg" alt="Свитер Сахарок" />
<PhotoSlot ratio="4 / 5" label="" style={{width:66}} />   {/* list-row thumbnail, no caption */}
```

Default ratio is **4:5** — a printed portrait proportion. Placeholders are a flat `--surface-sunken` plate
with a 2px radius: paper, not a rounded tile. Pass `label=""` at thumbnail sizes, where a caption would not fit.

Photography direction: warm daylight, cream / oat / pale-wood grounds, the garment on a small light-coloured
dog at dog eye level. No studio gradients, no grain, no filters.
