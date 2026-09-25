import { Injectable, signal } from '@angular/core';
import { updatePreset } from '@primeuix/themes';
import Aura from '@primeng/themes/aura';
import Lara from '@primeng/themes/lara';
import Nora from '@primeng/themes/nora';

export type ThemeName = 'aura' | 'lara' | 'nora';

/**
 * Application appearance, applied as a class on `body`:
 * `light` → no class, `dark` → `body.dark-theme`, `kinesilk` → `body.theme-kinesilk`.
 */
export type Appearance = 'light' | 'dark' | 'kinesilk';

export interface Theme {
  name: string;
  preset: typeof Aura;
}

export const THEMES: Record<ThemeName, Theme> = {
  aura: { name: 'Aura', preset: Aura },
  lara: { name: 'Lara', preset: Lara },
  nora: { name: 'Nora', preset: Nora },
};

/** Appearance options with their i18n label keys — shared by every selector. */
export const APPEARANCE_OPTIONS: { labelKey: string; value: Appearance }[] = [
  { labelKey: 'settings.appearance.mode.light', value: 'light' },
  { labelKey: 'settings.appearance.mode.dark', value: 'dark' },
  { labelKey: 'settings.appearance.mode.kinesilk', value: 'kinesilk' },
];

const THEME_STORAGE_KEY = 'appTheme';
const APPEARANCE_STORAGE_KEY = 'appAppearance';
/** Legacy boolean key — read once to migrate users coming from dark-mode only. */
const LEGACY_DARK_MODE_KEY = 'darkMode';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private _currentTheme = signal<ThemeName>(this.getStoredTheme());
  private _appearance = signal<Appearance>(this.getStoredAppearance());

  get currentTheme(): ThemeName {
    return this._currentTheme();
  }

  /** Current appearance (body class) — centralised here. */
  get appearance(): Appearance {
    return this._appearance();
  }

  get themeOptions(): { label: string; value: ThemeName }[] {
    return [
      { label: 'Aura', value: 'aura' },
      { label: 'Lara', value: 'lara' },
      { label: 'Nora', value: 'nora' },
    ];
  }

  constructor() {
    this.applyTheme(this._currentTheme());
    this.applyAppearance(this._appearance());
  }

  setTheme(themeName: ThemeName): void {
    this._currentTheme.set(themeName);
    localStorage.setItem(THEME_STORAGE_KEY, themeName);
    this.applyTheme(themeName);
  }

  /** Sets the appearance (persists + applies the matching body class). */
  setAppearance(mode: Appearance): void {
    this._appearance.set(mode);
    localStorage.setItem(APPEARANCE_STORAGE_KEY, mode);
    this.applyAppearance(mode);
  }

  private applyTheme(themeName: ThemeName): void {
    const theme = THEMES[themeName];
    if (theme) {
      updatePreset(theme.preset);
    }
  }

  private applyAppearance(mode: Appearance): void {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('dark-theme', mode === 'dark');
      document.body.classList.toggle('theme-kinesilk', mode === 'kinesilk');
    }
  }

  private getStoredTheme(): ThemeName {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && stored in THEMES) {
      return stored as ThemeName;
    }
    return 'aura';
  }

  private getStoredAppearance(): Appearance {
    const stored = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'kinesilk') {
      return stored;
    }
    // Migrate the legacy boolean dark-mode flag: only `true` maps to `dark`,
    // everything else (absent included) defaults to `light`.
    if (localStorage.getItem(LEGACY_DARK_MODE_KEY) === 'true') {
      return 'dark';
    }
    return 'light';
  }
}
