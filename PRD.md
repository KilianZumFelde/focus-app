# Product Requirements Document
## Personal Todo List — Desktop Web App

### Overview
A minimalistic, browser-based personal task manager. Clean, spacious design inspired by Hinge —
soft colors, lots of whitespace, intuitive without explanation.

---

### Layout & Navigation
- **Left sidebar** — always visible on desktop
  - Special views at the top: **This Week**, **All Tasks**
  - Areas listed below with a color dot per area
  - A **Completed** section at the bottom of the sidebar
  - A button to **add a new area**
- **Main content area** — right of the sidebar, shows tasks for the selected view/area

---

### Areas
- User can create, rename, and delete areas
- Default areas: Finances, Health, Social, Job, Misc
- Each area is assigned a unique soft color from a predefined palette
- Deleting an area with tasks shows a confirmation warning

---

### Tasks
Each task has:
- **Title** (short name)
- **Description** (optional longer text)
- **Done / Not done** status
- **"This week"** flag — mark it to include it in the This Week view

### Reordering
Tasks and goals can be reordered by dragging within the **This Week** and **area** views. Order is saved automatically.
- Desktop: standard mouse drag
- Mobile: hold finger for 300ms to activate, then drag. The delay prevents accidental drags while scrolling.

### Color coding
- Each area has a unique soft color
- Tasks display that color as a left border accent
- Tasks also show a small colored area tag so you always know which area a task belongs to
- Especially useful in the "This Week" view where tasks from multiple areas are mixed

---

### Views
| View | Shows |
|---|---|
| **This Week** | All tasks flagged "this week", across all areas, not yet done |
| **An area** (e.g. Health) | All open tasks in that area |
| **All Tasks** | All open tasks across all areas |
| **Completed** | All done tasks, browseable but separate |

---

### Behavior
- Completing a task triggers a two-step animation: soft green flash (~300ms) then card collapses and fades out (~300ms), then moves to Completed
- Completed tasks are accessible but never mixed with open tasks
- All data persists locally in the browser (localStorage — no login, no server)
- Deleting an area warns the user if it has tasks

---

### Weekly Goals

Recurring tasks that reset every Monday. Separate from one-off tasks but tied to an area.

**Where they appear:**
- **This Week** — all goals across all areas, at the top above flagged tasks, separated by a divider
- **Area views** — that area's goals at the top, above one-off tasks, separated by a divider
- Not in: All Tasks, Completed

**How they work:**
- Each goal belongs to an area (inherits its color and tag)
- Has a target threshold (e.g. 6) set at creation, editable later
- Counter with `+` and `−` buttons tracks progress (e.g. 3 / 6)
- When counter reaches target: shows as done visually, stays in the list
- Every Monday on app open: all counters reset to 0 automatically
- Created via a `+ New goal` button in This Week and area views
- Fields: title, area, target number

---

### Mobile layout (responsive)

Activates at screen width ≤768px. Desktop layout unchanged above that.

**Bottom navigation bar:**
- This Week — main weekly view
- + (center button) — opens mini action menu: New task / New goal
- Areas — opens the Areas screen

**Areas screen:**
- Full-screen list of all areas, each tappable to enter that area
- + Add area button
- All Tasks row at the bottom (muted style — less prominent)

**Inside area / All Tasks views:**
- Back button (←) returns to Areas screen
- Open / Completed toggle to switch between active and done tasks

**PWA (Progressive Web App):**
- Installable on phone via browser "Add to Home Screen"
- Works offline via service worker
- No App Store required

### Out of scope (v1)
- Due dates / calendar
- Subtasks
