# CLAUDE.md — Personal Todo App

## What this is
A minimalistic browser-based personal task manager. Single user, no backend, no login.
Data is stored in the browser via localStorage.

## Stack
Plain HTML + CSS + JavaScript. No frameworks, no build tools.
Open `index.html` directly in a browser to run it (desktop).
For mobile: host over HTTPS and install as PWA via browser "Add to Home Screen".

## PWA files
- `manifest.json` — app name, icons, theme color
- `service-worker.js` — caches assets for offline use
- `icon.svg` — app icon source

## Design philosophy
- Minimalistic, clean. Inspired by Hinge (soft colors, lots of whitespace, rounded corners)
- Desktop layout only
- Less is more — don't add complexity that wasn't asked for

## Key concepts
- **Areas** — user-defined categories (Finances, Health, Social, Job, Misc + custom). Each has a unique soft color.
- **Tasks** — belong to an area. Have a title, optional description, done/not-done status, and a "this week" flag.
- **Weekly Goals** — recurring tasks with a counter + target threshold (e.g. 3/6). Reset every Monday. Belong to an area. Appear at the top of This Week and area views, above tasks, separated by a divider.
- **Views** — This Week (all goals + flagged tasks), per-area (area goals + area tasks), All Tasks, Completed (archive)
- **Color coding** — each area has a unique color generated procedurally using the golden angle (137.5°) to spread hues evenly around the color wheel. Fixed saturation (45%) and lightness (78%) keep all colors soft/pastel. No ceiling — works for any number of areas.
- **Drag-and-drop reordering** — available for tasks in This Week and area views (not in All Tasks or Completed)


## File structure
- `index.html` — page structure
- `style.css` — all styling
- `app.js` — all logic (state, localStorage, rendering, events)
- `PRD.md` — product requirements
- `README.md` — how to open/use

## Decisions made
- No due dates or subtasks (out of scope for v1)
- Drag-and-drop reordering is supported in This Week and area views (mouse on desktop, touch on mobile)
- Touch drag uses a 300ms hold delay to distinguish from scrolling; works for both tasks and goals
- Goals can be reordered across the full goal list (not scoped to area)
- Deleting an area with tasks shows a confirmation warning
- Completed tasks are fully separate from active tasks
- Task completion uses a two-step animation: green flash → collapse/fade (~300ms each), then state updates
- Mobile layout activates at ≤768px via CSS media query — desktop layout is untouched
- Modals on mobile use `visualViewport` resize listener to stay above the Android keyboard; `autocomplete="off"` on all inputs suppresses the autofill bar
- Mobile nav: bottom bar (This Week | + | Areas), Areas screen is a full-screen list
- The + button opens a mini action menu (New task / New goal) anchored above it
- Completed toggle (Open / Completed) appears in All Tasks and area views on mobile
