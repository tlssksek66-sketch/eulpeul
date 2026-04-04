# CLAUDE.md

## Project Overview

**EULPEUL** (영업 기획 & IMC 매니지먼트 중앙 통제 시스템) — a Sales Planning & IMC Management Central Control System. Single-page web application built with vanilla HTML5, CSS3, and JavaScript (ES6+). No frameworks, no build tools, no external dependencies.

All UI text is in Korean. The app targets sales managers and marketing professionals.

## Repository Structure

```
eulpeul/
├── index.html              # Single HTML entry point (all views as hidden sections)
├── assets/
│   ├── js/
│   │   ├── app.js          # Main application controller (view switching, events, rendering)
│   │   ├── data-store.js   # localStorage data layer (CRUD, stats, sample data)
│   │   └── chart-engine.js # Custom Canvas-based charting (line, bar, doughnut, radar)
│   └── css/
│       └── style.css       # Complete styling (dark theme, responsive, CSS variables)
├── LICENSE                 # Eclipse Public License v2.0
└── .gitignore
```

**Total codebase:** ~3300 lines across 4 source files. No server-side code.

## Architecture

- **SPA pattern:** 6 views (Dashboard, Sales Planning, IMC Management, Sales Pipeline, Analytics, Settings) toggled via CSS classes on a single DOM tree
- **Module pattern:** Three global objects — `DataStore`, `ChartEngine`, `App` — each acting as a module
- **Data persistence:** Browser `localStorage` under key `eulpeul_data`
- **Charts:** Custom Canvas API rendering with DPI-aware scaling
- **No build step:** Files are served directly to the browser

## Key Conventions

### JavaScript
- `camelCase` for variables and functions
- Objects-as-modules pattern (not ES6 classes): `const App = { ... }`
- Method names prefixed with action verbs: `render*`, `get*`, `set*`, `handle*`, `save*`, `delete*`, `show*`, `close*`
- Event delegation via `querySelectorAll` + `forEach` + `addEventListener`
- View state managed by `classList.toggle('active', condition)` and `data-*` attributes

### CSS
- `kebab-case` for class names (`.nav-item`, `.kpi-card`)
- CSS custom properties for theming (defined in `:root`)
- Dark theme: `--bg-primary: #0f1117`, `--accent-blue: #4a7cff`
- Fonts: Noto Sans KR + Inter
- Mobile breakpoint: `768px` (sidebar collapses to hamburger menu)

### HTML
- Semantic structure with `data-view` attributes for view identification
- Inline event attributes avoided; all events bound in JS

### Language
- All user-facing strings are Korean
- Numbers formatted in Korean style (억/만 units)
- Date formats use Korean month names (1월, 2월)

## Development

### Running Locally
Open `index.html` in a browser. No install, build, or server required.

### Making Changes
1. Edit the relevant file directly
2. Refresh browser to see changes
3. Data resets available via Settings view or `DataStore.resetData()`

### File Responsibilities
| File | Purpose |
|------|---------|
| `index.html` | All HTML markup and view structure |
| `app.js` | Navigation, event binding, DOM rendering, modals, search, export |
| `data-store.js` | Data initialization, load/save, stats calculation, sample data |
| `chart-engine.js` | Canvas chart rendering (line, bar, doughnut, radar), formatting utils |
| `style.css` | All styling, layout, animations, responsive design |

### No Tests or Linting
There is no test framework, linter, or formatter configured. Validate changes by manual browser testing.

## Common Tasks

- **Add a new view:** Add HTML section in `index.html`, add nav item, add rendering logic in `app.js`, add view switching in `switchView()`
- **Add a new chart type:** Extend `ChartEngine` with a new `draw*` method following existing patterns
- **Modify data schema:** Update sample data in `data-store.js`, update rendering in `app.js`
- **Change theme colors:** Modify CSS custom properties in `:root` in `style.css`

## Important Notes

- No external API calls — the app is fully client-side
- localStorage data is per-browser, per-origin — no cross-device sync
- Auto-refresh runs every 30 seconds (configurable in Settings)
- All chart canvases re-render on window resize
