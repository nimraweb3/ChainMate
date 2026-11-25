# Original ChainMate artwork

Created for this project with the built-in OpenAI image generation tool. The user's three reference screenshots informed art direction only; no reference artwork, branding or screenshot is embedded in the app. The source PNG files are retained in `assets/source/`.

## Generation briefs

The following records the visual briefs used for the three generations (not a provider seed or reproducibility guarantee).

1. **Hero knight:** Wide premium chess product photograph on near-black. A monumental faceted black-chrome knight at right, a smaller pearl bishop behind it, silver studio reflections with restrained copper and cyan accents. Reflective dark plinth. Left 45% is clean negative space for live HTML typography. Dramatic sculptural silhouette, precise materials, no lettering, no logos, no watermarks.
2. **Pearl gallery:** A luxury chess collection photographed on a pale pearl background and silver chessboard. Copper knight, cobalt bishop, opalescent queen, black-chrome king. Gallery lighting, convincing reflections and material detail, restrained composition, no labels, text or logos.
3. **Opponents:** Three equally spaced isolated chess sculptures in a wide triptych against black: copper rook, platinum-blue bishop, titanium knight with cyan edge light. Full sculptural forms and reflective bases, consistent camera and lighting, no text or logos. Each third becomes an individual opponent portrait.

## Delivered assets

| File under `apps/web/public/art/` | Use                            |   Bytes |
| --------------------------------- | ------------------------------ | ------: |
| hero-knight.webp                  | Desktop hero                   |  76,148 |
| hero-knight-small.webp            | Smaller reusable hero variant  |  31,052 |
| hero-mobile.webp                  | Mobile still-image crop        |  62,744 |
| gallery.webp                      | Desktop pearl gallery          | 135,222 |
| gallery-small.webp                | Mobile gallery                 |  47,976 |
| bitcoin.webp                      | Copper rook / beginner         |  34,582 |
| ethereum.webp                     | Platinum bishop / intermediate |  33,238 |
| solana.webp                       | Titanium knight / advanced     |  47,276 |

`node scripts/art-assets.mjs` regenerates WebP derivatives using Sharp. It never enlarges the source. Mobile hero is explicitly a crop of a still, not a native portrait video. Art has descriptive alt text; decorative repeated images use empty alt text. The hero has high fetch priority; lower imagery is lazy loaded. There is no paid video generation, autoplay film, or runtime image-generation dependency.
