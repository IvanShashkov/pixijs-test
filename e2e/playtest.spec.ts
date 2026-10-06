import { expect, test } from '@playwright/test';
import { boot, expectNoErrors, scene, settle, shot } from './helpers.ts';

const WORLDS = ['horizon', 'wow'] as const;
const LOCALES = ['en', 'ru'] as const;

test('boots into the main menu with one canvas and no errors', async ({ page }) => {
  const collected = await boot(page);
  expect(await page.locator('canvas').count()).toBe(1);
  expect(await scene(page)).toBe('menu');
  expectNoErrors(collected);
});

test('main menu in both worlds and both languages', async ({ page }, testInfo) => {
  const collected = await boot(page);
  for (const world of WORLDS) {
    await page.evaluate((w) => window.__game!.setWorld(w), world);
    for (const locale of LOCALES) {
      await page.evaluate((l) => window.__game!.setLocale(l), locale);
      await page.evaluate(() => window.__game!.goTo('menu'));
      await settle(page, 500);
      expect(await scene(page)).toBe('menu');
      await shot(page, `menu-${world}-${locale}`, testInfo);
    }
  }
  expectNoErrors(collected);
});

for (const world of WORLDS) {
  test(`round in ${world}: board, cascade, pause, results with loot`, async ({
    page,
  }, testInfo) => {
    const collected = await boot(page);
    await page.evaluate((w) => window.__game!.setWorld(w), world);
    await page.evaluate(() => window.__game!.setLocale('en'));
    await page.evaluate(() => window.__game!.startRound({ seed: 42, seconds: 60 }));
    await settle(page, 600);
    expect(await scene(page)).toBe('game');
    await shot(page, `game-${world}`, testInfo);

    const moved = await page.evaluate(() => window.__game!.playMove());
    expect(moved).toBe(true);
    await settle(page, 180);
    await shot(page, `game-cascade-${world}`, testInfo);
    await page.waitForFunction(() => window.__game!.snapshot().game?.busy === false);

    const before = await page.evaluate(() => window.__game!.snapshot().game!.remainingMs);
    await page.evaluate(() => window.__game!.pause());
    const atPause = await page.evaluate(() => window.__game!.snapshot().game!.remainingMs);
    expect(atPause).toBeLessThan(before + 1);
    await settle(page, 600);
    const paused = await page.evaluate(() => window.__game!.snapshot());
    expect(paused.game!.phase).toBe('paused');
    expect(paused.game!.remainingMs).toBe(atPause);
    await shot(page, `game-paused-${world}`, testInfo);
    await page.evaluate(() => window.__game!.resume());

    const wallet = await page.evaluate(() => window.__game!.store.getState().wallet.points);
    await page.evaluate(() => window.__game!.endRound({ score: 2600 }));
    await settle(page, 2900);
    const snap = await page.evaluate(() => window.__game!.snapshot());
    expect(snap.scene).toBe('results');
    const settings = await page.evaluate(() => window.__game!.store.getState().settings);
    const expectedDrops = Math.min(
      settings.lootCap,
      Math.floor((2600 * settings.scoreCoefficient) / settings.lootPerPoints),
    );
    expect(snap.drops).toBe(expectedDrops);
    const afterRound = await page.evaluate(() => window.__game!.store.getState().wallet.points);
    expect(afterRound).toBe(wallet + Math.round(2600 * settings.scoreCoefficient));
    await shot(page, `results-${world}`, testInfo);

    // Roulette mid-spin, then let everything open (openAll awaits every roulette).
    await page.evaluate(() => {
      void window.__game!.openChest(0);
    });
    await settle(page, 1400);
    await shot(page, `roulette-${world}`, testInfo);
    await page.evaluate(() => window.__game!.openAllLoot());
    await settle(page, 700);
    await shot(page, `results-open-${world}`, testInfo);
    const afterLoot = await page.evaluate(() => window.__game!.store.getState().wallet.points);
    expect(afterLoot).toBeGreaterThanOrEqual(afterRound);
    expectNoErrors(collected);
  });

  test(`meta scenes in ${world}`, async ({ page }, testInfo) => {
    const collected = await boot(page);
    await page.evaluate((w) => window.__game!.setWorld(w), world);
    await page.evaluate(() => window.__game!.setLocale('en'));
    // Give the shop something to sell against and the collection something to show.
    await page.evaluate(() => window.__game!.store.getState().addPoints(1500));
    await page.evaluate(
      (w) => window.__game!.store.getState().unlockActivity(w, 'activity-2'),
      world,
    );
    for (const key of ['shop', 'inventory', 'collection', 'settings'] as const) {
      await page.evaluate((k) => window.__game!.goTo(k), key);
      await settle(page, 500);
      expect(await scene(page)).toBe(key);
      await shot(page, `${key}-${world}`, testInfo);
    }
    expectNoErrors(collected);
  });
}

test('russian results and settings', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'landscape', 'landscape only');
  const collected = await boot(page);
  await page.evaluate(() => window.__game!.setWorld('wow'));
  await page.evaluate(() => window.__game!.setLocale('ru'));
  await page.evaluate(() => window.__game!.startRound({ seed: 7, seconds: 60 }));
  await settle(page, 300);
  await shot(page, 'game-wow-ru', testInfo);
  await page.evaluate(() => window.__game!.endRound({ score: 1800 }));
  await settle(page, 2900);
  await shot(page, 'results-wow-ru', testInfo);
  await page.evaluate(() => window.__game!.goTo('settings'));
  await settle(page, 400);
  await shot(page, 'settings-wow-ru', testInfo);
  expectNoErrors(collected);
});
