import { Injectable, signal } from '@angular/core';
import { updatePreset } from '@primeuix/themes';
import Aura from '@primeng/themes/aura';
import Lara from '@primeng/themes/lara';
import Nora from '@primeng/themes/nora';

export type ThemeName = 'aura' | 'lara' | 'nora';

export interface Theme {
  name: string;
  preset: typeof Aura;
}

export const THEMES: Record<ThemeName, Theme> = {
  aura: { name: 'Aura', preset: Aura },
  lara: { name: 'Lara', preset: Lara },
  nora: { name: 'Nora', preset: Nora },
};

const THEME_STORAGE_KEY = 'appTheme';
const DARK_MODE_KEY = 'darkMode';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private _currentTheme = signal<ThemeName>(this.getStoredTheme());
  private _darkMode = signal<boolean>(this.getStoredDarkMode());

  get currentTheme(): ThemeName {
    return this._currentTheme();
  }

  /** Modo oscuro (body.dark-theme) — centralizado acá. */
  get darkMode(): boolean {
    return this._darkMode();
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
    this.applyDarkMode(this._darkMode());
  }

  setTheme(themeName: ThemeName): void {
    this._currentTheme.set(themeName);
    localStorage.setItem(THEME_STORAGE_KEY, themeName);
    this.applyTheme(themeName);
  }

  /** Enciende/apaga el modo oscuro (persiste + aplica body.dark-theme). */
  setDarkMode(value: boolean): void {
    this._darkMode.set(value);
    localStorage.setItem(DARK_MODE_KEY, value ? 'true' : 'false');
    this.applyDarkMode(value);
  }

  /** Toggle rápido de modo oscuro. */
  toggleDarkMode(): void {
    this.setDarkMode(!this._darkMode());
  }

  private applyTheme(themeName: ThemeName): void {
    const theme = THEMES[themeName];
    if (theme) {
      updatePreset(theme.preset);
    }
  }

  private applyDarkMode(value: boolean): void {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('dark-theme', value);
    }
  }

  private getStoredTheme(): ThemeName {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && stored in THEMES) {
      return stored as ThemeName;
    }
    return 'aura';
  }

  private getStoredDarkMode(): boolean {
    return localStorage.getItem(DARK_MODE_KEY) === 'true';
  }
}