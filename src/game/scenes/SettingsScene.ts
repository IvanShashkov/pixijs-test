import { ScrollBox } from '@pixi/ui';
import { Container, Graphics } from 'pixi.js';
import { LOCALES, SETTINGS_LIMITS, WORLDS, type Locale, type World } from '../../config';
import type { TranslationKey } from '../../i18n';
import { Scene } from '../core/Scene';
import { enter } from '../core/anim';
import { TIMING } from '../../config';
import type { Viewport } from '../core/layout';
import { Backdrop } from '../ui/Backdrop';
import { UiButton } from '../ui/Button';
import { drawDivider } from '../ui/draw';
import { SliderRow } from '../ui/SliderRow';
import { Stepper } from '../ui/Stepper';
import { Tabs } from '../ui/Tabs';
import { LocalizedText } from '../ui/text';
import { TopBar } from '../ui/TopBar';

interface SettingsParams {
  scrollTop?: number;
}

const ROW_H = 56;

/** Steppers, sliders and tab rows only — no text input on canvas. All writes go through the store. */
export class SettingsScene extends Scene<SettingsParams | undefined> {
  private backdrop!: Backdrop;
  private topBar!: TopBar;
  private box: ScrollBox | null = null;
  private rows: Array<{ label: LocalizedText; control: Container; controlWidth: number }> = [];
  private rowItems: Container[] = [];
  private footer!: UiButton;
  private resetArmed = false;
  private pendingScroll = 0;
  private colWidth = 560;

  override init(params: SettingsParams | undefined): void {
    this.pendingScroll = params?.scrollTop ?? 0;
    const { store, scenes } = this.ctx;
    const s = store.getState();
    const lootKey: TranslationKey =
      this.theme.lootKind === 'chest' ? 'loot.chest' : 'loot.container';
    const lootName = () => this.tr(lootKey);

    this.backdrop = new Backdrop({ theme: this.theme, world: this.theme.world, tint: 0.7 });
    this.topBar = new TopBar({
      theme: this.theme,
      tweens: this.tweens,
      store,
      title: 'settings.title',
      onBack: () => void scenes.goTo('menu', undefined),
    });
    this.addChild(this.backdrop, this.topBar);

    const stepper = (
      key: keyof typeof SETTINGS_LIMITS,
      value: number,
      format: (v: number) => string,
      onChange: (v: number) => void,
    ) =>
      new Stepper({
        theme: this.theme,
        tweens: this.tweens,
        ...SETTINGS_LIMITS[key],
        value,
        format,
        onChange,
      });
    const slider = (
      key: keyof typeof SETTINGS_LIMITS,
      value: number,
      format: (v: number) => string,
      onChange: (v: number) => void,
    ) =>
      new SliderRow({
        theme: this.theme,
        ...SETTINGS_LIMITS[key],
        value,
        format,
        onChange,
        width: 160,
      });
    const update = (patch: Parameters<typeof s.updateSettings>[0]) =>
      store.getState().updateSettings(patch);
    const seconds = (v: number) => this.tr('settings.seconds', { n: v });

    this.addRow(
      'common.world',
      new Tabs({
        theme: this.theme,
        items: WORLDS.map((w) => `world.${w}` as const),
        index: WORLDS.indexOf(s.world),
        onChange: (i) => store.getState().setWorld(WORLDS[i] as World),
      }),
    );
    this.addRow(
      'common.language',
      new Tabs({
        theme: this.theme,
        items: LOCALES.map((l) => `lang.${l}` as const),
        index: LOCALES.indexOf(s.locale),
        onChange: (i) => store.getState().setLocale(LOCALES[i] as Locale),
      }),
    );
    this.addRow(
      'settings.roundSeconds',
      stepper('roundSeconds', s.settings.roundSeconds, seconds, (v) => update({ roundSeconds: v })),
    );
    this.addRow(
      'settings.scoreCoefficient',
      slider(
        'scoreCoefficient',
        s.settings.scoreCoefficient,
        (v) => `×${v.toFixed(1)}`,
        (v) => update({ scoreCoefficient: v }),
      ),
    );
    this.addRow(
      'settings.lootPerPoints',
      stepper('lootPerPoints', s.settings.lootPerPoints, String, (v) =>
        update({ lootPerPoints: v }),
      ),
      { loot: lootName() },
    );
    this.addRow(
      'settings.lootCap',
      stepper('lootCap', s.settings.lootCap, String, (v) => update({ lootCap: v })),
      { loot: lootName() },
    );
    this.addRow(
      'settings.lootBonusPoints',
      stepper('lootBonusPoints', s.settings.lootBonusPoints, String, (v) =>
        update({ lootBonusPoints: v }),
      ),
    );
    this.addRow('settings.lootWeights', this.makeDivider());
    const weights = s.settings.lootWeights;
    const weightFmt = (v: number) => `${v}`;
    this.addRow(
      'settings.weightBonus',
      slider('lootWeight', weights.bonus, weightFmt, (v) =>
        update({ lootWeights: { ...store.getState().settings.lootWeights, bonus: v } }),
      ),
    );
    this.addRow(
      'settings.weightNothing',
      slider('lootWeight', weights.nothing, weightFmt, (v) =>
        update({ lootWeights: { ...store.getState().settings.lootWeights, nothing: v } }),
      ),
    );
    this.addRow(
      'settings.weightActivity',
      slider('lootWeight', weights.activity, weightFmt, (v) =>
        update({ lootWeights: { ...store.getState().settings.lootWeights, activity: v } }),
      ),
    );

    this.footer = new UiButton({
      theme: this.theme,
      tweens: this.tweens,
      variant: 'ghost',
      label: 'settings.reset',
      labels: ['settings.reset', 'settings.resetConfirm', 'settings.resetDone'],
      height: 44,
      onPress: () => this.onReset(),
    });
    this.addChild(this.footer);
  }

  snapshot(): SettingsParams {
    return { scrollTop: this.box?.scrollY ?? 0 };
  }

  override async show(): Promise<void> {
    this.alpha = 1;
    this.backdrop.alpha = 0;
    void this.tweens.to(this.backdrop, { alpha: 1 }, { duration: TIMING.sceneFadeMs * 1.5 });
    const top = enter(this.tweens, [this.topBar], { from: 'top', distance: 20 });
    const rows = enter(this.tweens, this.rowItems, {
      from: 'right',
      distance: 26,
      delay: 80,
      stagger: 35,
      duration: 360,
    });
    const footer = enter(this.tweens, [this.footer], { from: 'bottom', distance: 20, delay: 300 });
    await Promise.all([top, rows, footer]);
  }

  layout(vp: Viewport): void {
    this.backdrop.layout(vp);
    this.topBar.layout(vp);
    const { width: w, height: h, safe } = vp;
    this.colWidth = Math.min(560, w - safe * 2);
    const top = this.topBar.bottom + 12;
    const footerH = 44 + safe * 2;
    const boxH = Math.max(120, h - top - footerH);
    this.rebuildBox(this.colWidth, boxH);
    this.box!.position.set((w - this.colWidth) / 2, top);
    this.footer.position.set(w / 2, h - safe - 22);
  }

  override update(ticker: Parameters<Scene['update']>[0]): void {
    super.update(ticker);
    this.backdrop.update(ticker.deltaMS);
  }

  private tr(key: TranslationKey, params?: Record<string, string | number>): string {
    const probe = new LocalizedText(this.theme, 'body', key, params);
    const text = probe.text;
    probe.destroy();
    return text;
  }

  private addRow(
    labelKey: TranslationKey,
    control: Container,
    params?: Record<string, string | number>,
  ): void {
    const label = new LocalizedText(this.theme, 'body', labelKey, params, {
      fontSize: 15,
      wordWrap: true,
      wordWrapWidth: 240,
    });
    label.anchor.set(0, 0.5);
    const controlWidth =
      control instanceof Tabs
        ? control.tabsWidth
        : control instanceof Stepper
          ? control.stepperWidth
          : control instanceof SliderRow
            ? control.rowWidth
            : 0;
    this.rows.push({ label, control, controlWidth });
  }

  private makeDivider(): Container {
    return new Container();
  }

  private rebuildBox(width: number, height: number): void {
    const scroll = this.box?.scrollY ?? this.pendingScroll;
    if (this.box) {
      for (const row of this.rows) {
        row.label.parent?.removeChild(row.label);
        row.control.parent?.removeChild(row.control);
      }
      this.box.removeItems();
      this.box.destroy({ children: true });
    }
    const box = new ScrollBox({
      width,
      height,
      type: 'vertical',
      elementsMargin: 0,
      padding: 0,
      globalScroll: false,
      dragTrashHold: 10,
    });
    this.box = box;
    this.addChild(box);
    const c = this.theme.colors;
    this.rowItems = [];
    for (const row of this.rows) {
      const item = new Container();
      this.rowItems.push(item);
      const isDivider =
        row.controlWidth === 0 &&
        row.control.children.length === 0 &&
        !(row.control instanceof Tabs);
      const line = new Graphics();
      if (isDivider) {
        drawDivider(line, this.theme, Math.min(width, 320));
        line.position.set(width / 2, ROW_H * 0.72);
        row.label.style.fill = c.accent;
        row.label.style.fontSize = 12;
        row.label.anchor.set(0.5, 0.5);
        row.label.position.set(width / 2, ROW_H * 0.35);
        item.addChild(line, row.label);
      } else {
        line.rect(0, ROW_H - 1, width, 1).fill({ color: c.border, alpha: c.borderAlpha });
        row.label.style.wordWrapWidth = Math.max(100, width - row.controlWidth - 24);
        row.label.position.set(0, ROW_H / 2);
        row.control.position.set(width - row.controlWidth, (ROW_H - 40) / 2);
        item.addChild(line, row.label, row.control);
      }
      // Give the row a stable height for the ScrollBox list.
      const spacer = new Graphics()
        .rect(0, 0, width, ROW_H)
        .fill({ color: 0xffffff, alpha: 0.001 });
      item.addChildAt(spacer, 0);
      box.addItem(item);
    }
    if (scroll) box.scrollY = Math.min(scroll, box.scrollHeight);
  }

  private onReset(): void {
    if (!this.resetArmed) {
      this.resetArmed = true;
      this.footer.setLabel('settings.resetConfirm');
      void this.tweens.delay(2500).then((ok) => {
        if (ok && this.resetArmed) {
          this.resetArmed = false;
          this.footer.setLabel('settings.reset');
        }
      });
      return;
    }
    this.resetArmed = false;
    this.ctx.store.getState().resetProgress();
    this.ctx.toasts.show('settings.resetDone');
    void this.ctx.scenes.rebuildCurrent();
  }
}
