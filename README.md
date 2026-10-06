# Wow & Horizon

A two-world match-3 game rendered entirely in PixiJS v8. Лиса (Blood Elf, "WoW") and Кама
(tribal-tech, "Horizon") each bring their own palette, fonts, gems, loot and costumes, taken from
the sibling wedding-invitation project.

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm test       # vitest: board / loot / store / i18n logic
pnpm e2e        # Playwright playtest → e2e/screenshots/*.png (uses installed Google Chrome)
pnpm build && pnpm lint && pnpm typecheck
```

## How it is put together

- **React is a mount shell.** `src/canvas/PixiStage.tsx` creates the Pixi `Application` and calls
  `bootGame`. There is no DOM UI.
- **Scenes** (`src/game/scenes`) are Containers with `init / layout / show / hide / destroy`,
  driven by a `SceneManager` that owns the ticker and resize handling: Boot → MainMenu → Game →
  Results, plus Shop, Inventory, Collection and Settings.
- **Theme per world** (`src/game/theme`): colours, fonts, panel/button silhouettes, ornaments and
  asset aliases. Switching world reloads that world's bundle and rebuilds the scene.
- **i18n** (`src/i18n`): typed `en` / `ru` dictionaries, `t()`, `LocalizedText`.
- **State** (`src/stores/gameStore.ts`): one persisted, versioned zustand store for settings,
  wallet, costumes and the activity collection, read from Pixi via `getState` / `subscribe`.
- **Pure gameplay** (`src/game/board`, `src/game/loot`): seeded, unit-tested match-3 and loot
  logic with zero Pixi imports; `BoardView` only animates the resulting cascade steps.
- **Tunables** live in `src/config.ts`.

See `CLAUDE.md` and `.claude/rules/` for the working rules, and
`.claude/notes/happy-wedding-research.md` for where the art comes from.
