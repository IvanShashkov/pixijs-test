import { easings, type Easing } from '../theme/ease';

export interface TweenOptions {
  duration: number;
  ease?: Easing;
  delay?: number;
  /** Called every frame with eased progress 0..1. */
  onUpdate?: (t: number) => void;
}

type NumericKeys<T> = { [K in keyof T]: T[K] extends number ? K : never }[keyof T];
export type NumericProps<T> = Partial<Pick<T, NumericKeys<T>>>;

interface Active {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  target: any;
  keys: string[];
  from: number[];
  to: number[];
  fromGiven: boolean;
  elapsed: number;
  delay: number;
  duration: number;
  ease: Easing;
  onUpdate?: (t: number) => void;
  resolve: (finished: boolean) => void;
  done: boolean;
}

/**
 * A tween handle: awaitable (`true` = finished, `false` = cancelled or group killed), cancellable.
 * Animation code should `if (!(await tween)) return;` so destroyed scenes never touch dead objects.
 */
export class Tween implements PromiseLike<boolean> {
  private readonly promise: Promise<boolean>;
  private readonly entry: Active;

  constructor(entry: Active, promise: Promise<boolean>) {
    this.entry = entry;
    this.promise = promise;
  }

  then<R1 = boolean, R2 = never>(
    onfulfilled?: ((value: boolean) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return this.promise.then(onfulfilled, onrejected);
  }

  cancel(): void {
    if (this.entry.done) return;
    this.entry.done = true;
    this.entry.resolve(false);
  }
}

/**
 * Minimal ticker-driven tween engine. Each scene owns a group that is advanced from the scene's
 * `update()` (so pausing a scene freezes its animations) and killed in `destroy()`.
 */
/**
 * A tween target is dead when it is a destroyed Container, or an ObservablePoint (scale /
 * position) whose owning Container was destroyed — Pixi nulls `_position` / `_scale` on destroy,
 * so writing to them would throw.
 */
function isDead(target: unknown): boolean {
  if (target === null || target === undefined) return true;
  const t = target as { destroyed?: boolean; _observer?: { destroyed?: boolean } | null };
  if (t.destroyed === true) return true;
  const owner = t._observer;
  return !!owner && owner.destroyed === true;
}

export class TweenGroup {
  paused = false;
  timeScale = 1;
  private active: Active[] = [];

  get size(): number {
    return this.active.length;
  }

  to<T extends object>(target: T, props: NumericProps<T>, opts: TweenOptions): Tween {
    return this.add(target, null, props as Record<string, number>, opts);
  }

  fromTo<T extends object>(
    target: T,
    from: NumericProps<T>,
    to: NumericProps<T>,
    opts: TweenOptions,
  ): Tween {
    return this.add(target, from as Record<string, number>, to as Record<string, number>, opts);
  }

  delay(ms: number): Tween {
    return this.add({}, null, {}, { duration: ms, ease: easings.linear });
  }

  update(deltaMS: number): void {
    if (this.paused || this.active.length === 0) return;
    const dt = deltaMS * this.timeScale;
    const list = this.active;
    for (const a of list) {
      if (a.done) continue;
      if (isDead(a.target)) {
        a.done = true;
        a.resolve(false);
        continue;
      }
      if (a.delay > 0) {
        a.delay -= dt;
        if (a.delay > 0) continue;
        a.elapsed = -a.delay; // carry the overshoot into the tween
        a.delay = 0;
        this.captureFrom(a);
      } else {
        a.elapsed += dt;
      }
      const raw = a.duration <= 0 ? 1 : Math.min(1, a.elapsed / a.duration);
      const t = a.ease(raw);
      for (let i = 0; i < a.keys.length; i++) {
        a.target[a.keys[i]] = a.from[i] + (a.to[i] - a.from[i]) * t;
      }
      a.onUpdate?.(t);
      if (raw >= 1) {
        a.done = true;
        a.resolve(true);
      }
    }
    this.active = list.filter((a) => !a.done);
  }

  /** Cancel every tween; pending awaits resolve with `false`. */
  killAll(): void {
    const list = this.active;
    this.active = [];
    for (const a of list) {
      if (!a.done) {
        a.done = true;
        a.resolve(false);
      }
    }
  }

  private captureFrom(a: Active): void {
    if (a.fromGiven) {
      for (let i = 0; i < a.keys.length; i++) a.target[a.keys[i]] = a.from[i];
      return;
    }
    for (let i = 0; i < a.keys.length; i++) a.from[i] = Number(a.target[a.keys[i]]) || 0;
  }

  private add(
    target: object,
    from: Record<string, number> | null,
    to: Record<string, number>,
    opts: TweenOptions,
  ): Tween {
    const keys = Object.keys(to);
    let resolve!: (finished: boolean) => void;
    const promise = new Promise<boolean>((r) => {
      resolve = r;
    });
    const entry: Active = {
      target,
      keys,
      from: keys.map((k) => (from ? from[k] : 0)),
      to: keys.map((k) => to[k]),
      fromGiven: from !== null,
      elapsed: 0,
      delay: opts.delay ?? 0,
      duration: opts.duration,
      ease: opts.ease ?? easings.quadOut,
      onUpdate: opts.onUpdate,
      resolve,
      done: false,
    };
    if (entry.delay <= 0) this.captureFrom(entry);
    this.active.push(entry);
    return new Tween(entry, promise);
  }
}
