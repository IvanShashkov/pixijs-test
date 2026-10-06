import { Container, type DestroyOptions, type Texture } from 'pixi.js';

interface SignalLike<A extends unknown[]> {
  connect(cb: (...args: A) => void): { disconnect(): void };
}

interface EmitterLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: any, fn: (...args: any[]) => void, context?: unknown): unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off(event: any, fn: (...args: any[]) => void, context?: unknown): unknown;
}

/**
 * Container with a disposer list. Every subscription, signal connection, DOM listener or
 * self-made texture is registered at the point of creation and released in `destroy()`.
 * Scenes and all UI components extend this; nothing else should hold cleanup state.
 */
export class Component extends Container {
  private readonly disposers: Array<() => void> = [];
  private disposed = false;

  get isDisposed(): boolean {
    return this.disposed;
  }

  /** Register a cleanup to run (LIFO) on destroy. */
  protected onDispose(fn: () => void): void {
    this.disposers.push(fn);
  }

  /** Connect to a @pixi/ui signal and disconnect on destroy. */
  protected connect<A extends unknown[]>(signal: SignalLike<A>, cb: (...args: A) => void): void {
    const conn = signal.connect(cb);
    this.onDispose(() => conn.disconnect());
  }

  /** Listen on a Pixi EventEmitter (renderer, container, …) and unlisten on destroy. */
  protected listen<E extends EmitterLike>(
    emitter: E,
    event: Parameters<E['on']>[0],
    fn: (...args: never[]) => void,
  ): void {
    emitter.on(event, fn as (...args: unknown[]) => void);
    this.onDispose(() => emitter.off(event, fn as (...args: unknown[]) => void));
  }

  /** Listen on a DOM target and unlisten on destroy. */
  protected listenDom<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    fn: (ev: WindowEventMap[K]) => void,
  ): void;
  protected listenDom<K extends keyof DocumentEventMap>(
    target: Document,
    type: K,
    fn: (ev: DocumentEventMap[K]) => void,
  ): void;
  protected listenDom(target: EventTarget, type: string, fn: EventListener): void {
    target.addEventListener(type, fn);
    this.onDispose(() => target.removeEventListener(type, fn));
  }

  /** Textures this component generated itself (not from Assets) — destroyed with it. */
  protected ownTexture<T extends Texture>(texture: T): T {
    this.onDispose(() => texture.destroy(true));
    return texture;
  }

  override destroy(options?: DestroyOptions): void {
    if (this.disposed) return;
    this.disposed = true;
    for (let i = this.disposers.length - 1; i >= 0; i--) this.disposers[i]();
    this.disposers.length = 0;
    // Never `texture: true` here: textures from Assets belong to the Assets cache.
    super.destroy(
      typeof options === 'object' ? { children: true, ...options } : { children: true },
    );
  }
}
