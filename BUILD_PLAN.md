# Ro5n3R build plan

## Implementation status — 2026-11-16

The first local-first milestone is implemented as a directly loadable Manifest V3 extension. It uses native HTML, CSS, and JavaScript modules with zero production dependencies; this is intentionally lighter than the proposed Vite toolchain. The current build includes the responsive sky-blue dashboard, light/dark themes, clock and greeting, four search engines, safe direct URL navigation, editable shortcuts, tasks with undoable deletion, notes/links/reminders capture, today's manual schedule, focus/timer/stopwatch modes, Chrome-alarm recovery, settings, multi-tab storage updates, reduced-motion support, and bounded rendered lists.

**Launchpad redesign, 2026-11-16 (version 0.2.0).** The navigation dock and three-column hero were replaced by a centred launchpad: clock and greeting, the search bar just above the middle of the window, then site tiles, with the work cards one scroll below. Part of phase 3 arrived early: opt-in most-visited sites (`topSites` as an optional permission) with real favicons (`favicon` permission), pin/unpin/hide with undo, arrow-key navigation, and search suggestions drawn from the user's own tiles. Recent history, bookmarks, open-tab search and recently closed tabs are still future work because they need broader permissions.

**Dusk dashboard, 2026-11-16 (version 0.3.0).** Replaced the centred launchpad with a three-column dashboard modelled on Kelvin's mockup: schedule, recent history (opt-in `history` permission) and Quick Capture on the left; clock, search and site tiles in the centre; a focus ring, the shortlist and Quick Stats (focus-day streak, tasks done, custom countdown) on the right. Dusk (dark) theme by default with a static inline-SVG scene. Fixed: Cancel and close buttons in every dialog now use `formnovalidate`, so they close without demanding required fields. Not built from the mockup: weather (needs a network service, phase 4), voice search, the Gemini engine chip (prefill not verified, phase 5), notifications and the sparkle button.

Still planned from phase 2: schema migration beyond version 1 and validated JSON export/import. Phases 3–5 remain future opt-in integrations.

## Outcome

A fast, local-first Chrome New Tab dashboard inspired by the supplied reference: launch searches and apps, capture work, see today's priorities, and run a focus session. Use a solid sky-blue background instead of wallpaper or background blur.

## Current starting point

- Only `Ro5n3R.json` exists. It is a draft Manifest V3 configuration, not a loadable extension.
- Referenced HTML and scripts do not exist; Calendar OAuth still has a placeholder client ID.
- The GitHub remote is intended to be `https://github.com/perzival-22/Ro5n3R`. Connection has not been verified because this environment blocked Git initialization and terminal network access.

## Technical and design decisions

- HTML, CSS, strict TypeScript, and Vite for a bundled static extension. No runtime UI framework or remotely hosted executable code.
- Build output: `dist/manifest.json`, dashboard HTML, bundled scripts, local icons, and an event-driven service worker.
- Pure modules for search routing, task rules, date handling, and timer calculations; DOM rendering in separate widget modules.
- Versioned local data schema for settings, tasks, notes, saved links, schedules, and timer state. Use `chrome.storage.local`; read only needed keys and migrate old schemas safely.
- Persist dates deliberately: timestamps for timer deadlines and instants; date-only strings for daily tasks; time-zone-aware handling for Calendar events.
- Sky-blue canvas `#D3E8FF`, pale cards `#F4F8FF`, blue accent `#0B57D0`, navy text `#182B49`. Store colors as CSS tokens and verify contrast. Optional true-black dark theme.
- Rounded cards, pill controls, scalloped SVG clock, small local icons, system font initially, subtle borders and shadows. No wallpaper, blur filters, embedded players, or continuous decorative animation.
- Desktop layout: navigation dock, clock/weather/media column, main search/tasks column, focus/capture/activity column. Collapse gracefully for smaller windows.
- Request optional permissions when a user enables an integration; disabling a widget stops its work. Keep the initial permission set minimal.

## Phase 1 — Loadable foundation and visual shell

1. Verify repository state and establish a feature branch when Git access permits; preserve existing files.
2. Convert the draft to an actual `manifest.json`, starting at development version `0.1.0`. Remove placeholder OAuth and references to missing scripts until those features exist.
3. Configure build, strict type checking, lint, and logic tests; add extension icons and ignore build artifacts and secrets.
4. Build the responsive dashboard with reusable card/button/input components, theme tokens, settings panel, keyboard focus, and clear empty states.
5. Add a live local clock and greeting; preferences include name, 12/24-hour display, theme, and enabled widgets.

Acceptance: production output loads through Chrome's Load unpacked; opening a new tab displays Ro5n3R without console errors or network dependencies.

## Phase 2 — Useful offline core

1. Search engine picker for Google, Bing, DuckDuckGo, and Brave; safely encode search terms and validate navigable URLs.
2. Editable quick-launch tiles with add/edit/remove and safe URL handling.
3. Tasks, notes, links, classes, assignments, and reminders with quick capture, completion, editing, and deletion recovery.
4. Today's view and a manually editable class schedule; distinguish manually saved entries from later Calendar events.
5. Pomodoro, timer, and stopwatch driven by stored timestamps. Use Chrome alarms and optional notifications for completion; reconcile after sleep, restart, and page reload.
6. Synchronize dashboard state across open new tabs; handle concurrent updates without silently dropping items.
7. Versioned JSON export/import with validation, preview, and explicit replace/merge behavior.

Acceptance: data survives restart; core features work offline; timers recover correctly; multiple dashboard tabs stay consistent.

## Phase 3 — Native browser navigation

1. Opt-in top sites, recent history, and bookmark folders, with limited initial result counts.
2. Unified search over open tabs, bookmarks, and saved local items; debounce input and ignore stale responses.
3. Selecting an open-tab result focuses that tab instead of opening a duplicate.
4. Load folder contents and more history only when requested; update visible widgets from browser events.
5. Handle denied or revoked permissions and empty browsing data gracefully.

Acceptance: useful results appear without copying the user's entire browsing database into extension storage or memory.

## Phase 4 — Weather and Google Calendar

1. Weather with manual city selection, optional location access, Celsius/Fahrenheit, cached responses, stale/offline labeling, and retry controls.
2. Configure a real Google OAuth client and extension identity before implementing Calendar connection; document setup separately from application code.
3. Request read-only Calendar access, show today's events, and support disconnect and cache removal. Never store access tokens in exported settings.
4. Cover all-day events, recurring instances, time zones, expired authorization, and API errors.
5. Deduplicate requests across dashboard tabs, bound cache size, and refresh only when stale and needed.

Acceptance: user-authorized account connection works in the extension; cached information remains useful offline; Calendar setup requirements and any verification obligations are documented.

## Phase 5 — Media and Gemini handoff

1. Prototype YouTube and Spotify tab control independently; verify which metadata and controls each site actually exposes before committing to the full UI.
2. Opt-in, narrowly scoped content scripts communicate with existing media tabs. No embedded player or broad all-site injection.
3. Add media cards, next/previous card navigation, keyboard-accessible controls, and swipe support; show a clear unsupported or disconnected state.
4. Gemini action pills prepare a prompt and offer a user-triggered copy-and-open flow. Use direct prefill only if a supported mechanism is verified; never auto-send private notes or browsing data.

Acceptance: tested controls work against real signed-in media tabs; unsupported actions are accurately represented; Gemini handoff requires explicit user action.

## Phase 6 — Performance, accessibility, and release

- Pause dashboard intervals and visual updates when hidden; use minute-level clock updates and second-level timer display updates only while visible.
- Allow the service worker to terminate normally; keep durable state outside worker globals and recreate necessary alarms when missing.
- Load optional widget modules on demand. Bound displayed lists and cached external data; do not retain detached DOM nodes or stale listeners.
- Test one visible dashboard, five dashboards, hidden dashboards, and repeated open/close cycles. Record Chrome version, hardware, memory footprint, JS heap, CPU, startup timing, and network activity. Compare against the phase-1 baseline.
- Initial asset budget: at most 150 KB gzip of first-load JavaScript and 1 MB packaged static assets excluding source maps. These are implementation targets, not measured claims.
- Startup target: usable local shell within 500 ms in a documented warm local test. No routine network requests from disabled widgets, no hidden-page rendering loops, and no sustained heap growth after repeated interactions.
- Check keyboard navigation, contrast, reduced motion, 200% zoom, narrow windows, and light/dark themes.
- Run lint, typecheck, unit tests, production build, and Chrome extension smoke tests. Test offline mode, permission refusal/revocation, reload, restart, device sleep, and malformed imports.
- Prepare README, installation instructions, permission explanations, privacy policy, screenshots, and a release ZIP. Describe external requests honestly: local-first does not mean Calendar, weather, search, and Gemini never contact external services.
- Push, merge, and Chrome Web Store submission remain separate approval steps.

## Test emphasis

Test meaningful behavior: search URL encoding, unsafe link rejection, schema migrations, date-only task filtering, timer pause/resume and sleep recovery, multi-tab updates, import validation, and cache freshness. Use extension journeys for new-tab loading, persistence, permissions, and alarms. Validate external integrations with real accounts only after local behavior passes.

## First delivery

Finish phases 1 and 2 as the first usable milestone: sky-blue dashboard, clock, search, editable shortcuts, local productivity tools, focus timer, and settings. Browser integrations follow as independently testable additions.
