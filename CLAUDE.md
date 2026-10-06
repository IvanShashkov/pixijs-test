# Wow & Horizon — match-3 in PixiJS v8

Two-world match-3 game ("WoW" with Лиса, "Horizon" with Кама). **Everything the player sees is
drawn in PixiJS** — menus, HUD, shop, inventory, collection, settings, results, heroine. React is
a one-component mount shell. Vite + TypeScript + pnpm.

## Stack

| Concern        | Choice                                                                 |
| -------------- | ---------------------------------------------------------------------- |
| Rendering + UI | `pixi.js` v8, `@pixi/ui` (FancyButton, ScrollBox, Slider)              |
| State          | `zustand` (persist + subscribeWithSelector), consumed via `subscribe`  |
| Shell          | React 19: `src/canvas/PixiStage.tsx` only                              |
| Styling        | Tailwind v4 is used only for the base reset in `src/index.css`         |
| Tests          | vitest (pure logic), Playwright (`pnpm e2e`, screenshot playtest)      |
| Tooling        | Vite 8, TypeScript 6, ESLint flat config + typescript-eslint, Prettier |

Not used, do not add: `@pixi/react`, redux, `@tanstack/react-query`, DOM UI libraries.

## Commands

```sh
pnpm dev          # Vite dev server (http://localhost:5173)
pnpm build        # tsc -b && vite build → dist/
pnpm lint         # eslint .
pnpm typecheck    # tsc -b --noEmit (app + node/e2e projects)
pnpm test         # vitest run — pure board / loot / store / i18n / config tests
pnpm e2e          # playwright test — drives the game through window.__game, writes e2e/screenshots/
pnpm format       # prettier --write .
```

`build`, `lint`, `typecheck` and `test` must pass before a change is done. Run `pnpm e2e` and look
at the PNGs whenever a scene's layout changes.

## Structure and what belongs where

```
src/
  config.ts                 ALL tunables: board size, scoring, timings, settings ranges, prices, layout constants
  main.tsx / index.css      React entry (StrictMode) and the 10-line base stylesheet
  app/App.tsx               renders <PixiStage/>; nothing else
  canvas/PixiStage.tsx      the ONLY React component: creates the Application, calls bootGame(app), cleans up
  assets/manifest.ts        Assets manifest — bundles fonts / shared / wow / horizon / {world}/bg/{orientation}
  assets/loadAssets.ts      memoised Assets.init / loadBundle / loadWorld / loadBackground
  i18n/{en,ru}.ts, index.ts typed dictionaries + t(); `TranslationKey` is derived from en
  stores/gameStore.ts       the persisted, versioned store (+ sanitizeSettings, migrateSave, createGameStore factory)
  game/
    bootGame.ts             wires SceneManager, toasts, store→scene propagation, dev hook; returns { dispose }
    testHooks.ts            DEV-only window.__game driver used by Playwright
    core/                   Component (disposer base), Scene, SceneManager, TweenGroup, anim.ts (enter/popIn/dropIn/loopPulse), layout helpers, types
    theme/                  ThemeConfig + wow.ts / horizon.ts + alias helpers + easings
    ui/                     theme-driven widgets: draw.ts primitives, text.ts, Button, Panel, Tabs, Stepper, SliderRow,
                            ScrollGrid, Card, TopBar, WalletChip, Toast, Backdrop, GroundStrip
    entities/               BoardView, Heroine, LootChest, Roulette (case-opening spinner), Celebration, Particles (BurstFx, FloatingText)
    board/                  PURE match-3 logic (no Pixi): rng, createBoard, findMatches, moves, gravity, cascade, reshuffle
    loot/                   PURE loot logic: drop count, weighted rolls, activity degradation
    data/                   costume + activity catalogues
    scenes/                 Boot, MainMenu, Game, Results, Shop, Inventory, Collection, Settings
public/assets/              fonts/, shared/, {wow,horizon}/{heroine,costumes,animations,activities,backgrounds,gems,loot}
e2e/                        playtest.spec.ts + helpers.ts; screenshots/ is gitignored
.claude/
  rules/                    pixi-shell-and-scenes.md · theming-i18n-ui.md (read before touching src/game)
  notes/happy-wedding-research.md   where the art, palettes and sprite conventions come from
  skills/pixijs-*           official PixiJS v8 skills
```

Decision rule: if it is a number someone might tune, it goes in `config.ts`. If it is a string the
player reads, it goes in `i18n/en.ts` + `ru.ts`. If it is a colour, font or shape, it goes in
`game/theme/*`. Logic that can be unit-tested without a renderer goes in `board/` or `loot/`.

## Rules

### PixiJS v8 only

- `new Application()` then `await app.init({...})`. Never `new Application(options)`.
- Graphics: build a path then `.fill()` / `.stroke()`. Never `beginFill` / `drawRect` / `lineStyle`.
- Loading only through `Assets` + the manifest. Never `Loader`, `Texture.from(url)`, `new Image()`.
- `app.canvas`, not `app.view`; `ticker.deltaMS` from the Ticker passed to the callback.
  When unsure, consult the installed `pixijs-*` skills or https://pixijs.com/llms.txt.

### React is a mount shell, nothing more

- One component (`PixiStage`). No other `.tsx`, no DOM UI, no hooks anywhere else.
- `src/game/**`, `src/i18n/**`, `src/stores/**`, `src/assets/**`, `src/config.ts` must not import
  React (lint-enforced). `src/game/board/**`, `src/game/loot/**`, `src/i18n/**` must not import
  Pixi either (lint-enforced) so they stay testable in node.

### The store is the single source of truth

- World, locale, settings, wallet, owned/equipped costumes and the collection live in
  `gameStore` and nowhere else. Transient round state (score, timer) lives in the Game scene and
  is handed to Results as `RoundResult` params.
- Pixi reads with `store.getState()` and `store.subscribe(selector, cb)` registered via
  `this.onDispose(...)`. Never `setState` per frame.
- Every action validates (`sanitizeSettings`, ownership checks). Persisted shape changes bump
  `SAVE_VERSION` and get a step in `migrateSave`.

### Scenes own their lifetime

- A scene is `new Scene(ctx)` → `init(params)` → `layout(vp)` → `show()` → `update(ticker)` →
  `hide()` → `destroy()`. The SceneManager owns the single `app.ticker` callback and the resize
  listener; scenes never touch either.
- Everything a scene or component creates is released in `destroy()` through the `Component`
  disposer: `onDispose`, `connect` (signals), `listen` (emitters), `listenDom`, `ownTexture`.
  Textures from `Assets` are never destroyed by scenes.
- World and locale switches rebuild the current scene (`scenes.rebuildCurrent()`); implement
  `snapshot()` when a scene has state worth carrying across the rebuild.
- Animations go through the scene's `TweenGroup`; always `if (!(await tween)) return;` so a
  destroyed scene never touches dead objects. Entrance choreography uses `core/anim.ts`
  (`enter`, `popIn`, `dropIn`) inside `show()`, after `layout()` has placed everything.
- Never use a visible object as a `mask`: Pixi does not render mask objects. Use an invisible twin.

### Theme-only colours, i18n-only strings

- Scenes and widgets read colours, fonts and shapes from `this.theme` (a `ThemeConfig`). No hex
  literals outside `src/game/theme/`.
- Player-facing text is `LocalizedText` / `t(key)`. Adding a key means adding it to both `en.ts`
  and `ru.ts` (the type and the i18n test enforce it). No text inputs on canvas; settings use
  steppers, sliders and tabs.

### Pure gameplay logic, tested

- Match detection, gravity, cascades, valid-move checks, reshuffles and loot rolls are pure
  functions with a seeded `Rng` parameter. Add a vitest case for every behaviour change.
- `BoardView` only _plays back_ `CascadeStep[]`; it never decides game rules.

## Conventions

- TypeScript `erasableSyntaxOnly` (no enums, no constructor parameter properties) and
  `verbatimModuleSyntax` (`import type`). Defaults taken from `as const` config objects need an
  explicit `: number` annotation.
- Prettier formats everything (`public/assets` and `.claude/skills` are ignored).
- Playwright uses the installed Google Chrome (`channel: 'chrome'`); no browser download needed.
