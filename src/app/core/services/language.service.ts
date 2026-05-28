import { Injectable, signal } from '@angular/core';
import { ES } from '../i18n/es';
import { EN } from '../i18n/en';

export type Language = 'es' | 'en';

const TRANSLATIONS: Record<Language, Record<string, string>> = { es: ES, en: EN };
const STORAGE_KEY = 'bw_language';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  readonly lang = signal<Language>(this.getInitialLang());

  readonly langOptions = [
    { label: 'Español', value: 'es' as Language },
    { label: 'English', value: 'en' as Language },
  ];

  private getInitialLang(): Language {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'es' || stored === 'en') return stored;
    }
    return 'es';
  }

  setLang(lang: Language): void {
    this.lang.set(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, lang);
    }
  }

  has(key: string): boolean {
    return key in TRANSLATIONS[this.lang()];
  }

  t(key: string, params?: Record<string, string>): string {
    const dict = TRANSLATIONS[this.lang()];
    let value = dict[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(`{{${k}}}`, v);
      }
    }
    return value;
  }
}
