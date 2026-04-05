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
- **Focus Areas** — user-defined categories (Career, Health, Music, Bachata, Misc + custom). Each has a unique soft color. Swipe left on mobile to delete with confirmation.
- **Tasks** — belong to an area. Have a title, done/not-done status, and a "this week" flag. No description, no editing after creation. Tap to complete (inline popup). In area view: hold to add to This Week, swipe left to delete. In This Week view: swipe left to remove from This Week. In Completed view: swipe left to delete permanently.
- **Habits** — recurring items with a counter + target threshold (e.g. 3/6). Reset every Monday. Belong to an area. Appear at the top of This Week, area, and All Tasks & Habits views, above tasks, separated by a divider. Tap to open counter popup. Swipe left to delete. When target is reached, card shows as done. A thin progress bar below the area tag shows count/target progress in the area color; turns green when done.
- **Views** — This Week (all habits + flagged tasks), per-area (area habits + area tasks), All Tasks & Habits (all habits + task sections), Completed (archive, swipe to delete)
- **Color coding** — each area has a unique color generated procedurally using the golden angle (137.5°) to spread hues evenly around the color wheel. Fixed saturation (45%) and lightness (78%) keep all colors soft/pastel. No ceiling — works for any number of areas.
- **Drag-and-drop reordering** — available for tasks in This Week, All Tasks, and area views (not in Completed)


## File structure
- `index.html` — page structure
- `style.css` — all styling
- `app.js` — all logic (state, localStorage, rendering, events)
- `PRD.md` — product requirements
- `README.md` — how to open/use

## Decisions made
- No due dates or subtasks (out of scope for v1)
- Drag-and-drop reordering is supported in This Week, All Tasks, and area views (mouse on desktop, touch on mobile)
- Touch drag uses a ≡ handle on the right of each card — activates instantly with no delay, no conflict with long-press
- Goals can be reordered across the full goal list (not scoped to area)
- Deleting an area with tasks shows a confirmation warning
- Completed tasks are fully separate from active tasks
- Task completion uses a two-step animation: green flash → collapse/fade (~300ms each), then state updates
- Mobile layout activates at ≤768px via CSS media query — desktop layout is untouched
- Modals on mobile use `visualViewport` resize listener to stay above the Android keyboard; `autocomplete="off"` on all inputs suppresses the autofill bar
- Mobile nav: bottom bar (This Week | + | Focus Areas), text-only labels (no icons). Areas screen is a full-screen list of cards (same style as task cards)
- The + button (mobile bottom nav) opens the unified "New" modal directly. Single modal with title, area selector, and a three-way toggle: This Week | Later | Habit. Selecting Habit reveals the weekly target counter. Modal has "Create new" header.
- "Completed ›" link appears at the right of the area/all-tasks header on mobile; back arrow returns to open tasks
- "Clear all" button appears in the header when viewing completed tasks (desktop and mobile); confirms before deleting
- Area cards use tap animation (80ms delay before navigation) so the press is always visible
- Service worker uses network-first strategy so updates deploy immediately without cache bumping
- Long-press (800ms) on "focus." title (desktop) or "This Week" bottom nav (mobile) → Export/Import data menu. Export saves a JSON backup; Import restores from a backup file. JSON includes version, exportedAt, areas, tasks, goals.
