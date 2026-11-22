# Bookwise Design System — tokens sincronizados 2026-11-22

Sources: `src/styles/_tokens.scss`, `src/styles.scss` (light + `body.dark-theme` overrides).
Fonts: Roboto (variable, self-hosted from `assets/fonts/`).

## Colors — brand palette

| Token | Value | Usage |
|---|---|---|
| `--bw-900` | `#012663` | darkest navy; sidebar gradient from |
| `--bw-800` | `#042661` | navy variant |
| `--bw-700` | `#0a2862` | navy variant; sidebar control bg |
| `--bw-600` | `#083d96` | navy variant; sidebar gradient to |
| `--bw-500` | `#0b3d95` | primary mid-blue; tab color (light), chip-text-primary |
| `--bw-400` | `#0e3b8b` | primary deep |
| `--bw-300` | `#046af4` | vibrant CTA, primary-color, selection, active sidebar border |
| `--bw-200` | `#60a7f0` | light accent |
| `--bw-100` | `#dbeafe` light / `rgba(4,106,244,0.22)` dark | very light tint |
| `--bw-50` | `#f0f6ff` light / `rgba(4,106,244,0.1)` dark | surface tint |

## Colors — semantic aliases

| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `var(--bw-500)` | brand primary |
| `--color-primary-dark` | `var(--bw-900)` | dark primary |
| `--color-primary-cta` | `var(--bw-300)` | CTA fills |
| `--color-accent` | `var(--bw-200)` | accent |
| `--bw-text-on-brand` | `#ffffff` | icons/text on brand fills (Kinesilk theme overrides to dark) |
| `--primary-color` | `var(--bw-300)` | PrimeNG compat |

## Colors — status (AgendaPro palette)

| Token | Value |
|---|---|
| `--bw-status-reservado` | `#77D0FA` |
| `--bw-status-confirmado` | `#ECBE51` |
| `--bw-status-asiste` | `#1FB27C` |
| `--bw-status-no-asistio` | `#FCCAC2` |
| `--bw-status-pendiente` | `#FD8991` |
| `--bw-status-en-espera` | `#1FB27C` |
| `--bw-status-cancelado` | `#E3E7ED` |

| Token | Value |
|---|---|
| `--bw-payment-paid` | `#1FB27C` |
| `--bw-payment-partial` | `#ECBE51` |
| `--bw-payment-unpaid` | `#FD8991` |

## Colors — chip text (WCAG AA text on 18% tint)

| Token | Light | Dark |
|---|---|---|
| `--bw-chip-text-online` | `#1d4ed8` | `#93c5fd` |
| `--bw-chip-text-remaining` | `#9a3412` | `#fdba74` |
| `--bw-chip-text-success` | `#166534` | `#86efac` |
| `--bw-chip-text-warning` | `#92400e` | `#fcd34d` |
| `--bw-chip-text-danger` | `#991b1b` | `#fca5a5` |
| `--bw-chip-text-secondary` | `#374151` | `#cbd5e1` |
| `--bw-chip-text-primary` | `#0b3d95` | `#93c5fd` |

## Surfaces

| Token | Light | Dark |
|---|--|---|
| `--surface-ground` | `#f0f5ff` | `#0f172a` |
| `--surface-card` | `#ffffff` | `#1e293b` |
| `--surface-border` | `#e5e7eb` | `#334155` |
| `--bw-surface-muted` | `#f3f4f6` | `#263449` |
| `--bw-surface-muted` | `#f3f4f6D` | `#263449` |
| `--p-skeleton-background` | — | `#334155` |

## Text colors

| Token | Light | Dark |
|---|---|---|
| `--text-color` | `#1a2744` | `#e4e4e7` |
| `--text-color-secondary` | `#6b7280` | `#94a3b8` |
| `--text-heading` | `#111827` | = --text-color |
| `--text-label` | `#374151` | `#cbd5e1` |
| `--bw-tab-color` | `var(--bw-500)` | `#60a5fa` |

## Typography

- Font: **Roboto** variable (self-hosted); fallback sans-serif.
- Base 16px, line-height 1.5; headings weight 500.

| Token | rem | px | Usage |
|---|---|---|---|
| `--bw-text-2xs` | 0.6875 | 11 | overlines/section labels (caps) |
| `--bw-text-xs` | 0.75 | 12 | captions, helpers |
| `--bw-text-sm` | 0.875 | 14 | tables, dense dialog content |
| `--bw-text-base` | 1 | 16 | body |
| `--bw-text-lg` | 1.125 | 18 | card titles, dialog headers |
| `--bw-text-xl` | 1.25 | 20 | inline money figures |
| `--bw-text-2xl` | 1.5 | 24 | subtotals |
| `--bw-text-3xl` | 1.875 | 30 | KPIs |
| `--bw-text-4xl` | 2.25 | 36 | hero figures |

Semantic roles: `--bw-font-overline` (2xs), `--bw-font-caption` (xs), `--bw-font-table` (sm), `--bw-font-body` (base), `--bw-font-title` (lg), `--bw-font-amount` (xl), `--bw-font-subtotal` (2xl), `--bw-font-kpi` (3xl), `--bw-font-display` (4xl). Weights: 400/500/600/700. Tracking: `--bw-tracking-overline` 0.06em, `--bw-tracking-tight` -0.01em.

## Spacing / Radius / Control

| Token | Value |
|---|---|
| `--bw-space-xs/sm/md/lg/xl` | 0.25/0.5/1/1.5/2 rem |
| `--bw-radius-sm/md/lg/pill` | 4/6/8/999 px |
| `--bw-control-height` | 2.5rem |
| `--bw-app-header-height` | 4.1875rem |

## Z-scale

`--z-base` 1 · `--z-overlay` 10 · `--z-float` 150 · `--z-backdrop` 300 · `--z-drawer` 400 · `--z-topbar` 500 (PrimeNG overlays start at 1000).

## Shadows

| Token | Value |
|---|---|
| `--bw-shadow-card` | `0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)` |
| `--bw-shadow-popover` | `0 4px 12px rgba(0,0,0,.15)` |
| `--bw-dialog-header-shadow` | `0 6px 10px -6px rgba(0,0,0,.08)` |
| `--bw-dialog-content-shadow` | `inset 0 -18px 14px -14px rgba(0,0,0,.07)` |
| `--bw-shadow-sidebar-toggle` | `0 2px 8px rgba(1,38,99,.3)` |
| `--bw-shadow-sidebar-tab` | `0 2px 8px rgba(1,38,99,.45)` |
| `--bw-shadow-sidebar-tab-hover` | `0 3px 12px rgba(4,106,244,.5)` |

## Component rules

- Chips: color-mix 18% tint surface + dark text variant in light, light text in dark; dot + label.
- Tabs (PrimeNG): transparent tablist/panel in dark, bound to `--bw-tab-color`.
- Sidebar chrome always dark (theme-invariant), Z ≤ 500 for app chrome.
- Dialogs: header shadow + inset content shadow; footer via pTemplate; zoneless Angular; PrimeNG preset fixed light with token bindings for dark.
- Calendar cards: pure HTML generators, `.fc .ev__*` classes; time inside the card, no displayEventTime.

## Notes

- Token files imported globally; `:root` lives in `_tokens.scss`; dark overrides under `body.dark-theme`.
- ADR: components never use literal values — tokens only.
