# The Pixi shell and the scene lifecycle

## 1. React mounts the canvas and stops there

`src/canvas/PixiStage.tsx` is the only React component. Its single effect creates the
`Application`, appends the canvas and boots the game; its cleanup tears both down. The async init
must survive StrictMode's mount → unmount → mount:

```ts
let cancelled = false;
let app: Application | null = null;
let game: GameHandle | null = null;

const setup = async () => {
  const instance = new Application();
  await instance.init({ resizeTo: window, autoDensity: true, preference: 'webgl', ... });
  if (cancelled) {
    instance.destroy(true, { children: true });
    return;
  }
  app = instance;
  host.appendChild(app.canvas);
  game = bootGame(app);
};

return () => {
  cancelled = true;
  game?.dispose();
  app?.destroy(true, { children: true }); // never texture: true — Assets owns textures
};
```

`bootGame(app)` (`src/game/bootGame.ts`) is synchronous and returns `{ dispose() }`. It creates
the `SceneManager`, the `ToastLayer`, the `SceneContext`, subscribes to the store (world → load
bundle under `withBusy` → `rebuildCurrent()`; locale → `setLocale` → `rebuildCurrent()`),
installs `window.__game` in DEV, and navigates to `boot`.

## 2. Component: the disposer base class

Every Pixi object we write extends `Component` (`src/game/core/Component.ts`). Register cleanup
where you create the thing:

```ts
this.onDispose(store.subscribe((s) => s.wallet.points, update));   // zustand
this.connect(button.onPress, () => ...);                            // @pixi/ui Signal
this.listen(this, 'pointerdown', onDown);                           // EventEmitter
this.listenDom(document, 'visibilitychange', onVisibility);          // DOM
const tex = this.ownTexture(renderer.generateTexture(...));         // self-made textures
```

`destroy()` runs the disposers LIFO and then `super.destroy({ children: true })`.

## 3. Scene contract

```ts
abstract class Scene<P = undefined> extends Component {
  constructor(ctx: SceneContext); // theme + viewport snapshot, own TweenGroup
  init(params: P): Promise<void> | void; // build the tree, lazy-load; NO positioning
  abstract layout(vp: Viewport): void; // idempotent; after init and on every resize
  show(): Promise<void>;
  hide(): Promise<void>; // default alpha fades
  update(ticker: Ticker): void; // default advances this.tweens; call super
  snapshot?(): P; // state to carry through rebuildCurrent()
  destroy(): void; // kills tweens, runs disposers
}
```

`SceneManager` (`src/game/core/SceneManager.ts`):

- `goTo(key, params)` — serialised on a promise chain: construct → `init` → fade in → old
  `hide()` + `destroy()` → add → `layout` → `show()` → fade out. The fade overlay blocks input.
  **Keep `current` pointing at the old scene until it has hidden**: its tweens only advance while
  the manager ticks it (this was a real deadlock).
- `rebuildCurrent()` — same key, `snapshot() ?? lastParams`. Used for world/locale switches.
- `withBusy(work)` — dims and blocks input while awaiting (bundle loads).
- Owns the one `app.ticker` callback (`current.update(ticker)`) and the renderer `resize`
  listener (`current.layout(viewport)`). Scenes never register either themselves.

Registry keys: `boot | menu | game | results | shop | inventory | collection | settings`
(`SceneParamsMap` in `src/game/core/types.ts` types the params).

## 4. Tweens

`TweenGroup` (`src/game/core/Tween.ts`): `to(target, { x, alpha, ... }, { duration, ease, delay,
onUpdate })` returns an awaitable `Tween` that resolves `true` when finished and `false` when
cancelled or the group was killed. Pattern for every animation sequence:

```ts
if (!(await this.tweens.to(sprite, { y: 0 }, { duration: 200 }))) return;
```

`TweenGroup.update` silently drops tweens whose target (or the Container owning a tweened
`scale` / `position`) has been destroyed — Pixi nulls `_position` on destroy, so a stray tween
would otherwise throw `Cannot set properties of null`. Still prefer not to destroy objects with
live tweens (e.g. `Card.setButton` reuses its button instead of recreating it).

The Game scene gives the board its own group (`boardTweens`) and simply stops updating it while
paused, so cascades freeze and resume intact. Tweening `this` inside a Component needs
`this as Container` because of the polymorphic `this` type.

## 5. Adding a scene

1. `src/game/scenes/FooScene.ts` extending `Scene<FooParams | undefined>`; build in `init`,
   position in `layout`, release in `destroy` via the disposer helpers.
2. Register it in `bootGame.ts` (`registry`) and in `SceneKey` / `SceneParamsMap`.
3. Navigate with `this.ctx.scenes.goTo('foo', params)`.
4. Add it to the Playwright gallery (`e2e/playtest.spec.ts`) and look at the screenshot.

## 6. Dev / e2e hook

`window.__game` (DEV only, `src/game/testHooks.ts`): `ready`, `goTo`, `setWorld`, `setLocale`,
`startRound({ seed, seconds })`, `endRound({ score })`, `pause/resume`, `playMove`,
`openAllLoot`, `settle(ms)`, `snapshot()`, `store`. The UI is canvas-only, so tests drive this
instead of clicking coordinates. Seeds make board and loot deterministic.
