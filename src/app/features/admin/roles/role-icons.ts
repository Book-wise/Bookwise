import type { Provider } from '@angular/core';
import {
  CircleQuestionMark,
  ClipboardList,
  ConciergeBell,
  Crown,
  LUCIDE_ICONS,
  LucideIconProvider,
  Scissors,
  ScissorsLineDashed,
  Store,
} from 'lucide-angular';

/**
 * Lucide glyphs used by the role surfaces (permissions matrix + role cards).
 *
 * Only this set is imported, so the bundle stays tree-shaken. Keys are the
 * PascalCase Lucide names; `RoleMeta.icon` holds the matching kebab-case
 * identifier, which the icon component normalizes.
 */
export const ROLE_ICONS = {
  Crown,
  Store,
  ConciergeBell,
  ClipboardList,
  Scissors,
  ScissorsLineDashed,
  CircleQuestionMark,
};

/**
 * Providers that register {@link ROLE_ICONS} with the Lucide icon component.
 *
 * Angular rejects `ModuleWithProviders` (what `LucideAngularModule.pick()`
 * returns) inside a standalone component's `imports`, so consumers import the
 * plain `LucideAngularModule` and spread these providers instead. Shared so
 * every role surface exposes exactly the same glyph set.
 */
export const ROLE_ICON_PROVIDERS: Provider[] = [
  { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ROLE_ICONS) },
];
