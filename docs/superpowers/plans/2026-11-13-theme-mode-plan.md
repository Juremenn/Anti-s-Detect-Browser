# Implementation Plan: Dark and Light Mode Support

**Spec Reference**: `docs/superpowers/specs/2026-11-13-theme-mode-design.md`  
**Execution Mode**: Inline via `executing-plans`  
**Standards**: `antislop` (during), WCAG AA 4.5:1 contrast, no em dashes, clean focus rings.

---

## Global Constraints
1. Tech Stack: React 18, TypeScript, Vite, CSS Variables (no external UI framework, no Tailwind).
2. Anti-Slop: No em dashes (`—`), no emojis, Lucide icons only (14px, stroke 1.5), 140ms ease-out transitions.
3. Theme persistence: `localStorage.getItem('octo_theme_mode')`.
4. Supported modes: `'dark' | 'light' | 'system'`.
5. HTML attribute: `document.documentElement.setAttribute('data-theme', resolvedTheme)`.

---

## Task 1: Theme Manager Hook (`useTheme`) & Types

- **Files**:
  - `frontend/src/types.ts`
  - `frontend/src/hooks/useTheme.ts`
- **Steps**:
  1. Add `ThemeMode = 'dark' | 'light' | 'system'` to `frontend/src/types.ts`.
  2. Create `frontend/src/hooks/useTheme.ts`:
     - Reads stored theme from `localStorage` (`'octo_theme_mode'`), default `'dark'`.
     - Detects system preference via `window.matchMedia('(prefers-color-scheme: dark)')`.
     - Computes `resolvedTheme: 'dark' | 'light'`.
     - Updates `document.documentElement.setAttribute('data-theme', resolvedTheme)`.
     - Provides `setThemeMode(mode: ThemeMode)` and `toggleTheme()`.
  3. Run typecheck via `npm.cmd run build` (tsc).
  4. Commit: `feat(theme): implement useTheme hook with system preference and localStorage persistence`.

---

## Task 2: TopBar Quick Toggle with Sun / Moon Icons

- **Files**:
  - `frontend/src/components/TopBar.tsx`
  - `frontend/src/App.tsx`
  - `frontend/src/i18n/en.ts`
  - `frontend/src/i18n/id.ts`
- **Steps**:
  1. Add i18n keys for theme toggle tooltips in `en.ts` and `id.ts` (`toggleTheme`, `themeDark`, `themeLight`, `themeSystem`).
  2. Update `TopBarProps` to accept `theme: 'dark' | 'light'`, `onToggleTheme: () => void`.
  3. Render `IconButton` with `Sun` (when dark, tooltip: "Switch to light mode") or `Moon` (when light, tooltip: "Switch to dark mode") next to fingerprint test button.
  4. Wire in `App.tsx` using `useTheme()`.
  5. Commit: `feat(theme): add 1-click theme toggle to TopBar`.

---

## Task 3: Appearance Section in Settings View

- **Files**:
  - `frontend/src/views/SettingsView.tsx`
  - `frontend/src/types.ts`
- **Steps**:
  1. Update `SettingsViewProps` to accept `themeMode: ThemeMode`, `onChangeThemeMode: (mode: ThemeMode) => void`.
  2. Add an "Appearance" card in `SettingsView` with `SegmentedControl`:
     - Options: `Dark` (Moon icon), `Light` (Sun icon), `System` (Monitor icon).
     - Informative caption explaining system auto-detection.
  3. Wire in `App.tsx`.
  4. Commit: `feat(theme): add Appearance theme selector to Settings page`.

---

## Task 4: Contrast & Component Polish in Light Mode

- **Files**:
  - `frontend/src/index.css`
- **Steps**:
  1. Audit all light mode tokens in `frontend/src/index.css` for 4.5:1 contrast and clean borders.
  2. Verify table row hover, inputs, modals, and dropdowns look crisp in light mode.
  3. Rebuild with Vite (`npm run build`).
  4. Verify in browser.
  5. Commit: `fix(theme): polish light mode tokens and contrast`.
