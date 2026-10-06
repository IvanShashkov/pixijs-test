import { expect, type Page, type TestInfo } from '@playwright/test';

/**
 * Structural mirror of `GameTestHook` (src/game/testHooks.ts). Kept local so the e2e project
 * (nodenext module resolution) does not pull the browser sources into its program.
 */
export interface GameTestHook {
  ready: Promise<void>;
  goTo(key: string, params?: unknown): Promise<void>;
  store: {
    getState(): {
      wallet: { points: number };
      settings: { lootCap: number; lootPerPoints: number; scoreCoefficient: number };
      collection: Record<string, string[]>;
      addPoints(delta: number): void;
      unlockActivity(world: string, id: string): boolean;
    };
    setState(patch: object): void;
  };
  setWorld(world: 'wow' | 'horizon'): Promise<void>;
  setLocale(locale: 'en' | 'ru'): Promise<void>;
  startRound(params?: { seed?: number; seconds?: number }): Promise<void>;
  endRound(options?: { score?: number }): Promise<void>;
  pause(): void;
  resume(): void;
  playMove(): Promise<boolean>;
  openAllLoot(): Promise<void>;
  openChest(index: number): Promise<void>;
  settle(ms: number): Promise<void>;
  snapshot(): {
    scene: string | null;
    game: { phase: string; remainingMs: number; score: number; busy: boolean } | null;
    drops: number | null;
  };
}

declare global {
  interface Window {
    __game?: GameTestHook;
  }
}

export interface Collected {
  errors: string[];
}

/** Load the app, wait for the dev hook and the first non-boot scene; collect console errors. */
export async function boot(page: Page): Promise<Collected> {
  const collected: Collected = { errors: [] };
  page.on('pageerror', (e) => collected.errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') collected.errors.push(`console: ${m.text()}`);
  });
  await page.goto('/');
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30_000 });
  await page.evaluate(() => window.__game!.ready);
  await settle(page, 300);
  return collected;
}

export async function settle(page: Page, ms: number): Promise<void> {
  await page.evaluate((t) => window.__game!.settle(t), ms);
}

export async function scene(page: Page): Promise<string | null> {
  return page.evaluate(() => window.__game!.snapshot().scene);
}

export async function shot(page: Page, name: string, testInfo: TestInfo): Promise<void> {
  await page.screenshot({ path: `e2e/screenshots/${name}-${testInfo.project.name}.png` });
}

export function expectNoErrors(collected: Collected): void {
  const relevant = collected.errors.filter((e) => !/WebGPU|GPU stall|swiftshader/i.test(e));
  expect(relevant, relevant.join('\n')).toEqual([]);
}
