# Theming, i18n, assets and the UI kit

## Theme

`ThemeConfig` (`src/game/theme/types.ts`) is the only source of colours, fonts, shapes and asset
aliases. `getTheme(world)` returns `wowTheme` or `horizonTheme`; scenes snapshot `ctx.theme` in
their constructor as `this.theme` and read **only** from it. No hex literals outside
`src/game/theme/`.

| Field      | What it drives                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| `colors`   | bg ramp, surfaces (+alpha), border, text, accent trio, secondary, glow, gems[]                                          |
| `fonts`    | heading / body stacks (primary + Cyrillic fallback), uppercase, letter spacing                                          |
| `shape`    | `panel: chamfer\|rounded`, `button: chamfer\|pill`, `corner: bracket\|flourish`, `divider: dots\|diamond`, border style |
| `assets`   | aliases for background (per orientation), ground, platform, run frame, gems, loot, activities, costumes                 |
| `ease`     | world-flavoured cubic-bezier used by UI tweens                                                                          |
| `backdrop` | `stars` (WoW gold star field) or `glows` (Horizon drifting cyan/amber glows)                                            |

`src/game/ui/draw.ts` turns the theme into Graphics: `drawPanel`, `drawButton(state)`,
`drawCorners`, `drawDivider`, `drawGlyph`, `shapePath`, `goldGradient`, `rgba`. Strokes use
`alignment: 1` (inside) so views stay exactly w × h for `FancyButton`.

The palette, decorative geometry and sprite conventions come from the sibling wedding site; see
`.claude/notes/happy-wedding-research.md` before inventing new ornaments.

## Text

- `textStyle(theme, variant)` / `makeText(theme, variant, raw)` for numbers and formatted values;
  `LocalizedText(theme, variant, key, params)` for anything from the dictionary. Variants:
  `title heading eyebrow body bodyMuted button buttonOnAccent hudLabel hudValue caption price small popup`.
- Heading variants are upper-cased per `theme.fonts.headingUppercase` (Horizon yes, WoW no).
- Fonts are self-hosted woff2 subsets registered with `unicodeRange`; Cinzel / Chakra Petch /
  Sora have no Cyrillic, so stacks fall back per glyph to Cormorant Garamond / Exo 2 / Inter.
- Locale lives in the store; `bootGame` mirrors it into `src/i18n` and rebuilds the current scene
  on change — there is no global registry of live Text nodes. Use `setParams` for dynamic values.
- Add keys to `en.ts` first (`TranslationKey` derives from it) and mirror them in `ru.ts`; the
  i18n test checks key parity and `{placeholder}` parity.

## Assets

- Everything is declared in `src/assets/manifest.ts` under aliases from `alias.*`
  (`src/game/theme/assets.ts`): `{world}/gem/{i}`, `{world}/costume/{i}`, `{world}/loot/closed`,
  `fx/whirl`, …; files live in `public/assets/**`.
- Bundles: `fonts`, `shared` (fx + both run frames), `wow`, `horizon`, and one bundle per
  `{world}/bg/{landscape|portrait}` backdrop. Boot loads fonts → shared → active world; the
  other world loads lazily on switch (`loadWorld`, under `scenes.withBusy`). `Backdrop` requests
  the missing orientation itself on rotation.
- `loadBundle` memoises per bundle and `Assets.init` runs once per page. Never destroy a texture
  obtained from `Assets.get`.
- Generated art: gems (`{world}/gems/{0..5}.svg`, 64 × 64, distinct shape + colour) and loot
  (`{world}/loot/{closed,open}.svg`, 128 × 112, bottom-aligned). SVGs load at `resolution: 2`.

## UI kit (`src/game/ui`)

| Component     | Built on               | Notes                                                                                                                                            |
| ------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `UiButton`    | `@pixi/ui FancyButton` | Graphics views per state from `drawButton`; hover/press scale via our tweens (FancyButton `animations` unused); width fits every key in `labels` |
| `Panel`       | Graphics               | surface + corner ornaments + optional title/divider; `content` inset by padding                                                                  |
| `Tabs`        | `ButtonContainer` ×N   | segmented control for world / language                                                                                                           |
| `Stepper`     | 2 × `UiButton`         | `[−] value [+]`, disables at bounds                                                                                                              |
| `SliderRow`   | `@pixi/ui Slider`      | theme-drawn track/fill/handle + value label                                                                                                      |
| `ScrollGrid`  | `@pixi/ui ScrollBox`   | rows of equally sized cards; `resize` re-flows the same card instances                                                                           |
| `Card`        | Panel + Sprite         | preview fitted into the top area, title, badge, optional action button                                                                           |
| `TopBar`      | UiButton + WalletChip  | back · title · wallet                                                                                                                            |
| `ToastLayer`  | Panel                  | lives in the SceneManager overlay; `ctx.toasts.show(key)`                                                                                        |
| `Backdrop`    | Sprite + Graphics      | orientation photo (cover) + tint + vignette + stars/glows                                                                                        |
| `GroundStrip` | `TilingSprite`         | pixel-art ground with faded edges; `floorOffset` = where feet stand                                                                              |

Entities: `Heroine` (height-normalised, feet-anchored, platform, whirl costume swap, idle bob,
`cheer()` on big combos), `BoardView` (fixed 100-unit cell space scaled in `layout`; tap-tap
and drag input; `playIntro()` cascade, `hintMove()` idle wiggle, invalid-swap shake, match rings;
plays `CascadeStep[]`; `whenIdle()` for round end), `LootChest` (idle bob + sparkle, shake →
`beforeReveal` hook → whirl → reward card), `Roulette` (modal case-opening strip that lands on
the pre-rolled drop; `fast` mode for "Open all"; tap to skip / close), `Celebration`, `BurstFx`,
`FloatingText`.

## Animation vocabulary

- `UiButton`: identical padded bounds for all states (no jump on hover), scale tween, hover
  sheen sweep (`playSheen`), optional `pulse` glow + periodic sheen for the primary CTA.
- Scenes: `show()` choreographs entrance with `enter` / `popIn` / `dropIn` from `core/anim.ts`
  (buttons rise, title pops, chests drop with a bounce, settings rows slide in from the right).
- Game: board intro cascade, 5 s idle hint, invalid-swap head-shake, gem-tinted match rings,
  score punch, timer urgency pulse, heroine cheer on ×3+ combos.
- Results: count-ups, chest bob + sparkles, roulette per chest, whirl reveal, celebration.
- Menu: title shimmer sweep every 3.6 s (masked by an invisible twin of the title).

Cursor policy: default cursor everywhere; interactive widgets may set `cursor = 'pointer'`. No
custom cursor images.
