---
name: mickey-shop-design
description: Use this skill to generate well-branded interfaces and assets for Микки Шоп / Mickey Shop, a pet-clothing store for small dogs shipping as a Telegram Mini App, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping. Default palette is Butter (single yellow hue + olive ink); wordmark is Bubblez Graffiti and is never used for anything but the wordmark.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

**One palette ships: Butter** — a single yellow ramp (Cornsilk → Naples yellow) plus an olive ink, in `tokens/colors.css`. There is no `data-palette` scope any more; the alternates were an exploration and were deleted at handoff. Components reference semantic aliases only (`--action-primary`, `--text-heading`, `--tag-sale-bg`, roles like `--accent-fav`) — never a ramp value. Dark theme is not a palette and must stay: Telegram Mini Apps inherit the user's theme.
