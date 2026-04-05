# Product Requirements Document
## focus. — Personal Task Manager

### Overview
A minimalistic, browser-based personal task manager. Clean, spacious design —
soft colors, lots of whitespace, intuitive without explanation. Single user, no backend, no login.

---

### Layout & Navigation

**Desktop:**
- Left sidebar — always visible
  - Special views at the top: **This Week**, **See All**
  - Focus Areas listed below, each with a color dot
  - **Completed** at the bottom of the sidebar
  - "Add area" button
- Main content area — right of sidebar

**Mobile (≤768px):**
- Bottom nav bar: **This Week** | **+** | **Focus Areas**
- Areas screen — full-screen list of area cards, tappable to enter
- Back button (←) returns to previous screen
- "Completed ›" link in the area/all header switches to completed tasks for that area

---

### Focus Areas
- User can create and delete areas
- Default areas: Career, Health, Music, Bachata, Misc
- Each area gets a unique soft/pastel color generated via golden angle (137.5°) — works for any number of areas
- Deleting an area that has tasks or habits shows a confirmation warning

---

### Tasks
- Fields: title, area, "this week" flag
- No description, no due date, no editing after creation
- Done / not-done status
- Tap to complete (inline popup with confirm). Completion triggers a two-step animation: green flash (~300ms) then card collapses and fades (~300ms), then moves to Completed
- **This Week flag** — marks a task for the weekly focus view. In area view: long-press card to toggle. In This Week view: swipe left to remove from week.
- Swipe left to delete in area and completed views

---

### Habits
Recurring items that reset every Monday.

- Fields: title, area, weekly target (number)
- Counter tracks progress (e.g. 3 / 6). Tap card to open counter popup with +/− buttons
- When counter reaches target: card shows as done visually, stays in the list
- Progress bar: a thin 4px bar below the area tag fills proportional to count/target. Area color when in progress, green when done. Animates on update.
- Reset every Monday on app open — all counters back to 0
- Appear at the top of every view, above tasks, separated by a divider
- Swipe left to delete

---

### Views

| View | Shows |
|---|---|
| **This Week** | All habits + tasks flagged "this week", not yet done |
| **An area** (e.g. Health) | That area's habits + open tasks |
| **See All** | All habits + all open tasks (grouped by area) |
| **Completed** | All done tasks (archive). On mobile: per-area completed tasks also available via "Completed ›" link |

---

### Drag-and-drop reordering
- Available in: This Week, See All, area views
- Not available in: Completed
- Desktop: mouse drag via ≡ handle on the right of each card
- Mobile: touch drag via same ≡ handle — activates instantly, no delay, no conflict with swipe or long-press
- Order is persisted in localStorage

---

### Color coding
- Each area has a unique procedurally generated soft color
- Tasks and habits display a small colored area tag
- Habit progress bar uses area color (turns green when done)
- Especially useful in This Week and See All where items from multiple areas are mixed

---

### Data persistence & backup
- All data stored in browser localStorage (`focus-app-v1`)
- No server, no account required
- **Export** — saves a JSON file: `{ version, exportedAt, areas, tasks, habits }`
- **Import** — restores from a JSON backup. Backward compatible with old exports using "goals" key.
- Desktop: long-press (800ms) on "focus." title in the sidebar
- Mobile: tap the "focus." link that appears in the main header when on the This Week view

---

### Weekly Review
- On first app open of a new week (Monday): a modal shows last week's habit and task stats
- User can choose to keep or remove unfinished tasks from This Week

---

### PWA
- Installable on phone via browser "Add to Home Screen"
- No service worker — no offline caching

---

### Out of scope (v1)
- Due dates / calendar
- Subtasks
- Editing tasks or habits after creation
- Multiple users / sync
