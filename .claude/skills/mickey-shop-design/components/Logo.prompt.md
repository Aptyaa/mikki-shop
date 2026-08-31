Brand lockup — app bars, onboarding, order confirmations, packaging.

```jsx
<Logo variant="horizontal" size="sm" />   {/* app bar */}
<Logo variant="arc" size="lg" />          {/* shop sign, onboarding, packaging */}
<Logo variant="perched" size="lg" />      {/* playful moments, empty states */}
<Logo variant="peeking" size="md" />      {/* narrow spaces, footers */}
<Logo variant="mark" mono size="sm" />    {/* favicon, stamp, embroidery */}
```

**Which arrangement when.** `horizontal` is the workhorse — use it unless there is a reason not to.
`arc` and `perched` are display lockups: they need vertical room and a calm background, so they belong on
onboarding, packaging and marketing, not in chrome. `peeking` is for tight horizontal bands.

**The wordmark is Bubblez Graffiti** (`--font-wordmark`) — an **outline** face, so letter interiors take
whatever is behind them and `color` sets the outline. Never below 20px, never over photography, never for
headings or UI labels.

**Two mascot files, on purpose.** The default is the transparent raster `mascot-mark.png` — required for
`perched` and `peeking`, where the art overlaps type. `vector` swaps in `mascot.svg`, the full-colour
vector, which carries a baked-in light plate from its trace: fine inside a disc or on a flat light surface,
wrong over an overlap. `mono` is the single-colour outline trace.

Never re-colour the mascot, never flip him, never add a drop shadow. Minimum mark size 28px.

**On a yellow band, the disc must be `--surface-inverse` (ink), not a butter tone.** The first version of
this rule said only "put him in a disc", which is not enough: a light disc on a yellow band measures 1.08:1
against the band and leaves the fur at 1.26:1 — *flatter* than the 1.36:1 he gets with no disc at all. White
fur cannot be separated by a light ground, because the fur is the light thing. An ink disc separates from
both — fur 12.42:1, disc against band 9.12:1 — and reads as a printed logo stamp, which suits the paper
direction. `--surface-inverse` follows the theme, so this holds in light and dark alike.

On the **page background** (cornsilk, not a band) the light `--disc-butter` is correct and is what
`variant="arc"` uses — there the disc's job is to warm the ground, not to rescue contrast.
