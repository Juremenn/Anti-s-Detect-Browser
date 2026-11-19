# Short Design: Dark and Light Mode Support

## 1. Intent & Context
The user requested adding Dark mode and Light mode to Octo Browser - Offline Studio. The CSS token foundation already exists in `frontend/src/index.css` under `:root` (Dark) and `[data-theme="light"]` (Light). This design establishes a theme manager hook, local persistence, a quick toggle in the TopBar, and configuration in the Settings page.

## 2. Goals & Non-Goals
- **Goals**:
  - Support `dark`, `light`, and `system` (matches OS preference via `prefers-color-scheme`).
  - Persist chosen theme in `localStorage` (`octo_theme_mode`).
  - Instant 1-click toggle between Dark and Light mode via a Sun/Moon IconButton in the TopBar.
  - Full theme selector (SegmentedControl: Dark / Light / System) in Settings page.
  - Maintain all anti-slop guidelines: no emojis, Lucide icons (`Sun`, `Moon`, `Monitor`), smooth 140ms color transitions, 4.5:1 text contrast.
- **Non-Goals**:
  - Custom palette creator or arbitrary theme colors (strict token fidelity).

## 3. Approaches Considered
1. **TopBar quick toggle + Settings option (Selected)**:
   - High accessibility: immediate toggle without leaving current work, plus system preference support in Settings.
2. **TopBar quick toggle only**:
   - Simple, but lacks OS preference auto-detection (`system` mode).
3. **Settings page only**:
   - Clunky UX: requires navigating away from the profiles table to change appearance.

## 4. Architecture & Implementation Plan
- **Theme Hook (`frontend/src/hooks/useTheme.ts`)**:
  - State: `themeMode: 'dark' | 'light' | 'system'`.
  - Resolved theme: `'dark' | 'light'`.
  - Sets `document.documentElement.setAttribute('data-theme', resolvedTheme)`.
  - Listens to `window.matchMedia('(prefers-color-scheme: dark)')` when in `system` mode.
- **TopBar (`frontend/src/components/TopBar.tsx`)**:
  - Add IconButton with `Sun` (when dark) or `Moon` (when light) next to the fingerprint test button.
  - Clicking toggles between `'dark'` and `'light'`.
- **Settings View (`frontend/src/views/SettingsView.tsx`)**:
  - Add "Appearance" section with SegmentedControl for `Dark` | `Light` | `System`.
- **i18n (`frontend/src/i18n/en.ts` and `id.ts`)**:
  - Add keys for `theme`, `themeDark`, `themeLight`, `themeSystem`.

