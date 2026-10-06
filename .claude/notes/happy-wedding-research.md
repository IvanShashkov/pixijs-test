# Research: `~/PycharmProjects/happy-wedding` → "Wow & Horizon"

Findings from the sibling wedding-invitation site (Next.js 16, Tailwind v4, framer-motion) that
drive the look, the sprite handling and the asset set of this game. Everything here is rendered in
canvas in this repo, so CSS tokens became TS theme objects (`src/game/theme/*.ts`).

## Worlds

|              | Horizon (`horizon`)                                                                                                                                                      | WoW (`wow`)                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Heroine      | **Кама** (sibling key `kama`) — tribal-tech                                                                                                                              | **Лиса** (sibling key `lisa`) — Blood Elf                                                                                                           |
| Loot         | containers                                                                                                                                                               | chests                                                                                                                                              |
| DNA          | angular HUD, 1 px cyan hairlines, 4 px radius, L-bracket corners, chamfered (14 px) panels; cool teal ↔ amber temperature split; quick easing `cubic-bezier(.2,.7,.3,1)` | regal gold filigree, 6 px radius, gold gradient borders, ruby diamond dividers, fel-green magical glow; stately easing `cubic-bezier(.25,.8,.25,1)` |
| Heading font | Chakra Petch (no Cyrillic) → **Exo 2** fallback (Cyrillic)                                                                                                               | Cinzel (no Cyrillic) → **Cormorant Garamond** fallback (Cyrillic)                                                                                   |
| Body font    | Sora (no Cyrillic) → **Inter** fallback                                                                                                                                  | Spectral (has Cyrillic)                                                                                                                             |

### Palette (`src/app/globals.css` `[data-world=…]`, `CostumeGallery.module.css`)

| Token                                 | Horizon                                                           | WoW                                                         |
| ------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------- |
| bg / bgFrom / bgMid / bgTo            | `#0E2A33` / `#0c2a2e` / `#123B47` / `#17495A`                     | `#1e0916` / `#1e0916` / `#3a0f24` / `#08040a`               |
| surface / raised                      | `rgba(18,59,71,.62)` / `rgba(23,73,90,.78)`                       | `rgba(52,18,32,.7)` / `rgba(74,26,46,.85)`                  |
| border                                | `rgba(47,198,216,.32)`                                            | `rgba(232,191,61,.4)`                                       |
| text / muted                          | `#EFE7D6` / `#A9BCC0`                                             | `#f6ead0` / `#e0c48e`                                       |
| accent / bright / deep / soft         | `#2FC6D8` / `#6DE4F0` / `#1B95A6` / 18 %                          | `#e8bf3d` / `#ffdb70` / `#a6791d` / 22 %                    |
| secondary                             | amber `#E8873C` (+ `#F4A94A`)                                     | crimson `#c8202a`                                           |
| extras                                | nature `#6E8B4A`, earth `#8A6A45`                                 | ruby `#e02040`, fel `#7dfe4c`, arcane `#7b4bbd`             |
| glow                                  | cyan `rgba(47,198,216,.45)`                                       | fel `rgba(125,254,76,.5)`, gold halo `rgba(232,191,61,.32)` |
| background FX (`BackgroundLayer.tsx`) | drifting cyan glow @ 28 % 30 % + amber glow @ 72 % 75 %, vignette | gold star field (2–5 px, `#ffdb70`/`#e8bf3d`), vignette     |
| ornament dots (`.ornament-*`)         | cyan 2 px / amber 1.5 px / cream 1 px                             | gold 1.5 px / ruby 2 px / fel 1.5 px                        |

### Decorative geometry (`src/components/ui/*`)

- **CardCorners**: 18 px SVG at 8 px inset. Horizon: `M2 10 L2 2 L10 2` stroke accent 1.2 + 1.4 px pip. WoW: `M2 12 Q2 2 12 2` (accent 1.2) + inner `M5 12 Q5 5 12 5` (accentBright 0.6, α .7) + ruby dot r 1.4 with bright centre r .6.
- **SectionDivider**: Horizon = 1 px accent lines α .4 with 4/6/4 px dots (outer dots glow). WoW = gold gradient lines fading outwards, 16 px diamond (45°, gradient bright→accent→deep, 12 px gold glow) with 6 px ruby core.
- **CTA / WorldLabel shapes**: Horizon chamfer 14 px on two opposite corners — button `polygon(14px 0,100% 0,100% calc(100%-14px),calc(100%-14px) 100%,0 100%,0 14px)`, label cuts the other diagonal. WoW = pill (`9999px`) or rounded-lg with gold gradient border `135deg #a6791d → #ffdb70 45–55 % → #a6791d` and inset crimson glow.
- **WorldSwitcher**: pill with two tabs, active = accent fill + black text + halo. Eyebrow labels: 10 px uppercase, tracking .45 em, accent.

## Character sprite conventions (`CostumeGallery.tsx` + module CSS)

- Costume sprites: front-facing, full body, feet together, tight transparent crop. 288×865 except `lisa-0` (179×536) → **normalise by height**: `scale = targetHeight / texture.height`, `anchor (0.5, 1)` at the feet. Sibling draws them `image-rendering: pixelated`; we keep linear filtering because they are down-scaled ~2.5×.
- Platform under the character; feet sink **55 % of the platform height** above the platform bottom; platform width ≈ 0.92 × character height.
- Costume change = 600 ms: sprite swapped at the midpoint under a whirlwind (`loading.webp`) that pops `scale .25 → 1.07 → 1 → 1.02 → .3` while flipping `scaleX` every 110 ms. Fallback: cross-fade + squash + dust ellipse.
- Hero intro (`HeroIntro.tsx`): side-view run frames (`animations/kama.webp`, `lisa.webp`, right one mirrored) run to the centre for 2.4 s (mobile) / 4.2 s with a bob (`y 0→-4 px`, `rotate ±1.5°`, 340 ms alternate, origin bottom-centre), swap to `hug.webp` (scale .94→1, 250 ms), `heart.webp` appears above after 350 ms (scale .6→1.15→1, 1.7 s), hold 1.1 s. Heights: runners 112, hug 128, heart 40. Ground strip `*-background.webp` tiled at 84 px tall with faded edges; feet at the strip's vertical middle.

## Asset mapping (sibling `public/photo/**` → `public/assets/**`)

| Source                                     | Dest                                                        | Purpose                                                                                              |
| ------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `costumes/kama-{0..3}.webp`                | `horizon/costumes/kama-{i}.webp`                            | Кама costumes: 0 rainbow rave suit (free default), 1 neon top + skirt, 2 evening dress, 3 cat onesie |
| `costumes/lisa-{0..3}.webp`                | `wow/costumes/lisa-{i}.webp`                                | Лиса costumes: 0 cowgirl (free default), 1 grey suit, 2 leather + fedora, 3 fox onesie               |
| `costumes/{horizon,wow}-platform.webp`     | `{world}/costumes/platform.webp`                            | stage platform (shop / inventory / menu)                                                             |
| `costumes/loading.webp`                    | `shared/animations/whirl.webp`                              | costume-change whirl, loot-open burst                                                                |
| `animations/{kama,lisa}.webp`              | `{world}/heroine/run.webp`                                  | side-view run frame → results celebration                                                            |
| `animations/{hug,heart}.webp`              | `shared/animations/*.webp`                                  | celebration (hug + heart)                                                                            |
| `animations/{horizon,wow}-background.webp` | `{world}/animations/ground.webp`                            | tileable ground strip                                                                                |
| `activities/{horizon,wow}-{0..7}.webp`     | `{world}/activities/{i}.webp`                               | 8 collectible activities (same meaning, world-specific art)                                          |
| `{horizon,wow}-{desktop,mobile}.webp`      | `{world}/backgrounds/{landscape,portrait}.webp`             | full-bleed backdrop picked by orientation                                                            |
| — generated —                              | `{world}/gems/{0..5}.svg`, `{world}/loot/{closed,open}.svg` | no suitable 64 px icons or chest art existed                                                         |
| — downloaded —                             | `fonts/*.ttf`                                               | OFL fonts, one file per family/weight                                                                |
| not copied                                 |                                                             | `cursors/*` (no custom cursors in this game), `tickets/*`, `location-block/*`, audio placeholders    |

Activities (`Invitation.tsx`, same list for both worlds): 0 Песенная программа · 1 Много вкусных
напитков · 2 Дефиле костюмов · 3 Всякие игрульки · 4 Караоке · 5 Плетение браслетиков · 6 Музыка
и танцы · 7 Свадебная церемония. Costumes have no names in the sibling; ours are in `src/i18n`.
