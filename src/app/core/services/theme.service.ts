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

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private _currentTheme = signal<ThemeName>(this.getStoredTheme());

  get currentTheme(): ThemeName {
    return this._currentTheme();
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
  }

  setTheme(themeName: ThemeName): void {
    this._currentTheme.set(themeName);
    localStorage.setItem(THEME_STORAGE_KEY, themeName);
    this.applyTheme(themeName);
  }

  private applyTheme(themeName: ThemeName): void {
    const theme = THEMES[themeName];
    if (theme) {
      updatePreset(theme.preset);
    }
  }

  private getStoredTheme(): ThemeName {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && stored in THEMES) {
      return stored as ThemeName;
    }
    return 'aura';
  }
}