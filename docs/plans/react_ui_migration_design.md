# Design Document: Octo Browser Offline UI Migration to React + Vite

## 1. Intent & Context
The user requested modernizing the Octo Browser Offline Studio interface by migrating from monolithic single-file HTML/vanilla JavaScript to a React-based single-page application (Option 1).
The current vanilla implementation, while functional, suffers from fragile DOM re-render management, manual state syncing across intervals, and tight coupling of HTML structure with event handlers. Migrating to React with Vite provides declarative state management, component isolation, seamless multi-selection, and a high-fidelity visual experience adhering strictly to `/antislop-ui` standards.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Full Feature Parity:** Replicate 100% of the active offline capabilities across all 5 views:
  - **Profiles:** Reactive table, multi-select checkboxes with bulk actions (Start Selected, Stop Selected, Move to Trash, Deselect), single-row actions (Start, Stop, Open Folder, Trash), search query filter, status filter, real-time status updates (PID running / Ready), hardware specs (OS icon, WebGL renderer, Cores/RAM/Resolution), tags with non-breaking wrapping.
  - **Trash Bin:** Trashed profile cards/table, restore profile, permanent delete, empty trash bin, dynamic trash badge count.
  - **Proxies:** Proxy list, add HTTP/SOCKS5 proxy modal, delete proxy, active proxy count.
  - **Templates:** Hardware presets list (RTX 3070, RTX 4080, Apple M2, AMD RX 6800), Quick Create from template with instant fingerprint seed generation.
  - **Settings:** Active Chromium engine selector, custom executable input, default start URL, WebRTC LAN IP leak protection toggle.
  - **Modals:** Create New Profile modal, Add Proxy modal.
  - **System:** Toast notification system, active Chromium engine badge in sidebar footer.
- **Strict Anti-Slop Compliance:**
  - Obsidian dark theme matching official Octo Browser (`#0b0d14`, `#10131e`, `#161926`, `#2f54eb`).
  - Zero decorative emojis in labels, headings, or buttons. Clean SVG iconography throughout.
  - High WCAG AAA text contrast, smooth 120ms transitions.
  - Purposeful empty states naming causes and direct actions (R-27).
  - No dead buttons or placeholder elements (R-26).
- **Single-Click Offline Execution:**
  - Python server (`web_ui_server.py`) continues serving the compiled production bundle from `web_ui/` on `http://127.0.0.1:58888`.
  - Double-clicking `Buka_Octo_Browser_UI.bat` launches the desktop app window immediately without requiring Node.js to be running during daily use.

### Non-Goals
- Cloud account integration or online authentication (must remain 100% offline).
- Migrating backend logic away from Python (stealth browser launcher and profile manager remain in Python).

### Anti-Goals
- Requiring the user to manually launch an `npm run dev` terminal to use the desktop application.
- Regressing to default unstyled browser widgets (e.g. stark white checkboxes or native alert popups).

---

## 3. Constraints
- **Operating System:** Windows with PowerShell execution policy restrictions (must use `npm.cmd` / `npx.cmd`).
- **Node Environment:** Node.js v24.22.1, npm 11.19.1.
- **Backend API:** Python 3.15 HTTP Server on port 58888 serving JSON endpoints:
  - `GET /api/profiles`, `POST /api/profiles/start`, `POST /api/profiles/stop`, `POST /api/profiles/create`, `POST /api/profiles/delete`, `POST /api/profiles/open_folder`
  - `GET /api/trash`, `POST /api/trash/restore`, `POST /api/trash/purge`
  - `GET /api/proxies`, `POST /api/proxies/add`, `POST /api/proxies/delete`
  - `GET /api/presets`, `GET /api/settings`, `POST /api/settings`

---

## 4. Approaches Considered

1. **Option 1: Vite + React SPA (Selected):**
   - Separate `frontend/` directory with Vite, React 19, TypeScript, and Tailwind CSS.
   - Outputs compiled production assets directly into `web_ui/`.
   - *Pros:* Ultra-fast builds, modular components, clean state isolation, standard industry architecture, zero runtime Node.js requirement in production.
   - *Cons:* Requires an initial build step (`npm.cmd run build`) during development.
2. **Option 2: CDN / Standalone React without Build Step:**
   - Loading React and Babel directly in the browser via offline vendor scripts.
   - *Pros:* No build step.
   - *Cons:* Slower load times, runtime JSX compilation overhead, difficult component modularity.
3. **Option 3: Full Electron Native App:**
   - Bundling React + Python backend into Electron.
   - *Pros:* Native window frame customization.
   - *Cons:* Substantially larger package size, added complexity for what Chrome `--app` mode already delivers cleanly.

---

## 5. Architectural & Component Design

### Directory Structure
```
Octo-Browser/
├── frontend/                     # React source directory
│   ├── package.json
│   ├── vite.config.ts            # Configured to build into ../web_ui
│   ├── tsconfig.json
│   ├── src/
│   │   ├── types.ts              # Profile, Proxy, Preset, Settings interfaces
│   │   ├── api.ts                # Typed fetch wrapper with error handling
│   │   ├── App.tsx               # Main layout (Sidebar + Active View Panel)
│   │   ├── components/
│   │   │   ├── Sidebar.tsx       # Navigation, badges, engine footer
│   │   │   ├── TopBar.tsx        # Action buttons, search bar, status dropdown
│   │   │   ├── BulkActionBar.tsx # Dynamic toolbar when >=1 profiles selected
│   │   │   ├── Checkbox.tsx      # Custom Obsidian SVG-backed checkbox
│   │   │   ├── Toast.tsx         # Floating notifications
│   │   │   └── EmptyState.tsx    # R-27 compliant empty state card
│   │   ├── views/
│   │   │   ├── ProfilesView.tsx  # Profiles table with selection & actions
│   │   │   ├── TrashView.tsx     # Soft-deleted profiles manager
│   │   │   ├── ProxiesView.tsx   # Proxy list and creation
│   │   │   ├── TemplatesView.tsx # Hardware preset cards
│   │   │   └── SettingsView.tsx  # Engine selection and launch preferences
│   │   └── modals/
│   │       ├── CreateProfileModal.tsx
│   │       └── AddProxyModal.tsx
├── web_ui/                       # Compiled production bundle served by Python
│   ├── index.html
│   └── assets/
└── web_ui_server.py              # Local HTTP & REST Server (Port 58888)
```

### State Management & Synchronization
- **Selection State:** Managed via `Set<string>` in `ProfilesView` to prevent selection reset during background status sync.
- **Live Status Polling:** 2-second background poll against `/api/profiles` that updates running PIDs and status pills without re-mounting row DOM elements.
- **Theme Variables:** CSS variables matching Octo Browser Obsidian palette (`#0b0d14`, `#10131e`, `#161926`, `#2f54eb`, `#38bdf8`, `#10b981`, `#ef4444`).

---

## 6. What's Left to the Builder
- Scaffold Vite + React in `frontend/` using `npm.cmd`.
- Implement TypeScript types and typed API client (`api.ts`).
- Build reusable UI components (custom Checkbox, Modal, Toast, Status Pill).
- Implement all 5 views with full feature parity.
- Configure `vite.config.ts` to output build artifacts directly to `../web_ui/`.
- Execute build and verify via automated tests.

