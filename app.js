// ─── Debug flags ─────────────────────────────────────────────────────────────
const DEBUG_WEEKLY_REVIEW = false; // set true to force weekly review modal on every load

// ─── Constants ────────────────────────────────────────────────────────────────

const MOBILE_BREAKPOINT    = 768;         // px — must match @media breakpoint in style.css
const STORAGE_KEY          = 'focus-app-v1';
const WEEKLY_REVIEW_KEY    = 'focus-weekly-review-shown';
const LONG_PRESS_DATA_MS   = 800;         // ms — long-press to open data menu
const VOICE_LONG_PRESS_MS  = 600;         // ms — long-press + to start voice recording
const TITLE_MAX_LENGTH     = 80;          // chars — enforced in voice parser
const VOICE_API_KEY_STORE  = 'focus-voice-api-key';
const COMPLETE_FLASH_MS    = 300;         // ms — green flash phase of task completion animation
const COMPLETE_COLLAPSE_MS = 300;         // ms — collapse phase of task completion animation
const SWIPE_THRESHOLD_PX   = 60;          // px — minimum swipe distance to trigger action
const COLOR_SUCCESS        = '#1a1a1a';   // matches --color-success in style.css
const COLOR_HABIT_DONE     = '#3faa6e';   // matches --color-habit-done in style.css

// ─── Color generation for areas ──────────────────────────────────────────────
// Spreads hues evenly around the color wheel using a golden angle offset
// so consecutive areas are always maximally distinct.
// Fixed saturation + lightness keeps all colors soft/pastel.

const GOLDEN_ANGLE = 137.508; // degrees — produces maximally spread hues

function generateAreaColor(index) {
  const hue = (200 + index * GOLDEN_ANGLE) % 360;
  return `hsl(${Math.round(hue)}, 45%, 78%)`;
}

// ─── Default state ────────────────────────────────────────────────────────────

const DEFAULT_STATE = {
  areas: [
    { id: 'a1', name: 'Career',  color: generateAreaColor(0) },
    { id: 'a2', name: 'Health',  color: generateAreaColor(1) },
    { id: 'a3', name: 'Music',   color: generateAreaColor(2) },
    { id: 'a4', name: 'Bachata', color: generateAreaColor(3) },
    { id: 'a5', name: 'Misc',    color: generateAreaColor(4) },
  ],
  tasks: [],
  habits: [],
  currentView: 'this-week',
};

// ─── State ────────────────────────────────────────────────────────────────────

let state = JSON.parse(JSON.stringify(DEFAULT_STATE));

let weeklyReviewStats = null;

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migration: rename goals → habits (data saved before this rename used "goals")
      if (parsed.goals && !parsed.habits) {
        parsed.habits = parsed.goals;
        delete parsed.goals;
      }
      state = { ...DEFAULT_STATE, ...parsed };
    }
  } catch (e) {
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
  weeklyReviewStats = resetHabitsIfNewWeek();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Returns the date string of Monday of the current week (e.g. "2026-03-30")
// Uses local timezone to avoid UTC date-shift for users east of UTC.
function getCurrentWeekKey() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function resetHabitsIfNewWeek() {
  const weekKey = getCurrentWeekKey();
  let changed = false;
  let stats = null;

  const needsReset = state.habits.some(g => g.lastResetWeek !== weekKey);
  const alreadyShown = localStorage.getItem(WEEKLY_REVIEW_KEY) === weekKey;

  if (needsReset || DEBUG_WEEKLY_REVIEW) {
    // Capture last week's stats before resetting
    const totalHabits = state.habits.length;
    const accomplishedHabits = state.habits.filter(g => g.count >= g.target).length;
    const thisWeekTasks = state.tasks.filter(t => t.thisWeek && !t.done);
    // Only count tasks completed during the week that just ended (not historical weeks)
    const [wy, wm, wd] = weekKey.split('-').map(Number);
    const prevMonday = new Date(wy, wm - 1, wd - 7);
    const prevWeekKey = `${prevMonday.getFullYear()}-${String(prevMonday.getMonth()+1).padStart(2,'0')}-${String(prevMonday.getDate()).padStart(2,'0')}`;
    const thisWeekTasksDone = state.tasks.filter(t => t.thisWeek && t.completedInWeek === prevWeekKey).length;
    const thisWeekTasksTotal = thisWeekTasks.length + thisWeekTasksDone;
    const incompleteThisWeekIds = thisWeekTasks.map(t => t.id);

    const hasSomethingToShow = totalHabits > 0 || thisWeekTasksTotal > 0;

    if (hasSomethingToShow && (!alreadyShown || DEBUG_WEEKLY_REVIEW)) {
      stats = {
        accomplishedHabits,
        totalHabits,
        thisWeekTasksDone,
        thisWeekTasksTotal,
        incompleteThisWeekIds,
      };
    }

    // Reset habits
    state.habits.forEach(habit => {
      if (habit.lastResetWeek !== weekKey) {
        habit.count = 0;
        habit.lastResetWeek = weekKey;
        changed = true;
      }
    });

    if (!DEBUG_WEEKLY_REVIEW) {
      localStorage.setItem(WEEKLY_REVIEW_KEY, weekKey);
    }
  }

  if (changed) saveState();
  return stats;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Derive a darker shade for readable text — works with hsl(...) color strings
function darkenColor(color) {
  const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (match) {
    return `hsl(${match[1]}, ${match[2]}%, 35%)`;
  }
  // Fallback for any legacy hex colors stored in existing data
  const r = Math.max(0, parseInt(color.slice(1, 3), 16) - 70);
  const g = Math.max(0, parseInt(color.slice(3, 5), 16) - 70);
  const b = Math.max(0, parseInt(color.slice(5, 7), 16) - 70);
  return `rgb(${r},${g},${b})`;
}

function pickNextColor() {
  return generateAreaColor(state.areas.length);
}

const isMobile = () => window.innerWidth <= MOBILE_BREAKPOINT;

function createSectionLabel(text) {
  const label = document.createElement('span');
  label.className = 'section-label';
  label.textContent = text;
  return label;
}

// ─── Shared render helpers ────────────────────────────────────────────────────

function getAreaColors(area) {
  return {
    borderColor: area ? area.color : '#ddd',
    tagBg:       area ? area.color + '33' : '#eee',
    tagColor:    area ? darkenColor(area.color) : '#666',
  };
}

function buildAreaTag(area) {
  if (!area) return '';
  const { tagBg, tagColor } = getAreaColors(area);
  return `<span class="area-tag" style="background:${tagBg};color:${tagColor}">${escapeHtml(area.name)}</span>`;
}

function getDefaultAreaId() {
  return state.areas.find(a => a.id === state.currentView)?.id || state.areas[0]?.id;
}

function commit() {
  saveState();
  render();
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function navigateTo(view) {
  mobileShowCompleted = false;
  state.currentView = view;
  updateMobileBottomNav(view);
  updateBackBtn(view);
  render();
}

// ─── Render: sidebar ──────────────────────────────────────────────────────────

function renderSidebar() {
  // Update active state on static nav items
  ['nav-this-week', 'nav-all', 'nav-completed'].forEach(id => {
    const el = document.getElementById(id);
    const view = el.dataset.view;
    el.classList.toggle('active', view === state.currentView);
  });

  // Render dynamic area list
  const areasList = document.getElementById('areas-list');
  areasList.innerHTML = '';

  state.areas.forEach(area => {
    const btn = document.createElement('button');
    btn.className = 'nav-item area-nav-item' + (state.currentView === area.id ? ' active' : '');
    btn.dataset.view = area.id;
    btn.innerHTML = `
      <span class="area-color-dot" style="background:${area.color}"></span>
      <span class="area-name">${escapeHtml(area.name)}</span>
      <span class="area-delete-btn" data-area-id="${area.id}" title="Delete area">×</span>
    `;

    btn.addEventListener('click', (e) => {
      if (e.target.closest('.area-delete-btn')) return;
      navigateTo(area.id);
    });

    areasList.appendChild(btn);
  });

  // Delete area buttons
  areasList.querySelectorAll('.area-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteArea(btn.dataset.areaId);
    });
  });
}

// ─── Render: habits ──────────────────────────────────────────────────────────

function getHabitsForView() {
  if (state.currentView === 'this-week' || state.currentView === 'all') return state.habits;
  if (state.areas.find(a => a.id === state.currentView)) {
    return state.habits.filter(g => g.areaId === state.currentView);
  }
  return [];
}

function renderHabits(taskList, prevProgressWidths = new Map()) {
  const habits = getHabitsForView();
  if (habits.length === 0) return false;

  const isLabelledView = state.currentView === 'this-week' || state.areas.find(a => a.id === state.currentView);
  if (isLabelledView) {
    taskList.appendChild(createSectionLabel('HABITS'));
  }

  habits.forEach(habit => {
    const area = state.areas.find(a => a.id === habit.areaId);
    const { borderColor } = getAreaColors(area);
    const isDone = habit.count >= habit.target;

    const card = document.createElement('div');
    card.className = 'habit-card' + (isDone ? ' habit-done' : '');
    card.style.borderLeftColor = borderColor;
    card.dataset.habitId = habit.id;

    const progress = habit.target > 0 ? Math.min(habit.count / habit.target, 1) : 0;
    const fillColor = isDone ? COLOR_HABIT_DONE : (area ? area.color.replace(/^hsl\((.+)\)$/, 'hsla($1, 0.8)') : 'transparent');

    card.innerHTML = `
      <div class="habit-card-main">
        <div class="habit-card-content">
          <div class="habit-title-row">
            <span class="habit-title">${escapeHtml(habit.title)}</span>
          </div>
          <div class="task-meta">${buildAreaTag(area)}</div>
        </div>
        <span class="counter-display${isDone ? ' counter-done' : ''}">${isDone ? '✓ ' : ''}${habit.count} / ${habit.target}</span>
        <div class="drag-handle"></div>
      </div>
      <div class="habit-progress-bar">
        <div class="habit-progress-fill" style="width:${prevProgressWidths.get(habit.id) ?? `${Math.round(progress * 100)}%`};background:${fillColor}"></div>
      </div>
    `;

    if (!isDone) addHabitTapPopup(card, habit);
    if (isMobile()) addSwipeLeft(card, () => showHabitDeletePopup(card, habit.id));
    if (!isMobile()) addDragHandlers(card, habit.id, 'habit');
    addTouchDragHandlers(card, habit.id, 'habit', card.querySelector('.drag-handle'));
    taskList.appendChild(card);
    requestAnimationFrame(() => {
      card.querySelector('.habit-progress-fill').style.width = `${Math.round(progress * 100)}%`;
    });
  });

  return true;
}

// ─── Render: header ───────────────────────────────────────────────────────────

function updateViewHeader() {
  const addNewBtn = document.getElementById('add-new-btn');

  // Compute title and addNewBtn visibility
  let title = '';
  if (state.currentView === 'this-week') {
    title = 'This Week';
    addNewBtn.classList.remove('hidden');
  } else if (state.currentView === 'all') {
    title = 'All Tasks & Habits';
    addNewBtn.classList.remove('hidden');
  } else if (state.currentView === 'completed') {
    title = 'Completed';
    addNewBtn.classList.add('hidden');
  } else {
    const area = state.areas.find(a => a.id === state.currentView);
    title = area ? area.name : '';
    addNewBtn.classList.remove('hidden');
  }

  if (mobileShowCompleted) title += ' — Completed';
  document.getElementById('view-title').textContent = title;

  // Mobile: "Completed ›" link — visible on area/all views when not already showing completed
  const isAreaOrAll = state.currentView === 'all' || state.areas.find(a => a.id === state.currentView);
  document.getElementById('completed-link').classList.toggle(
    'hidden', !isMobile() || !isAreaOrAll || mobileShowCompleted
  );

  // Mobile: "focus." link — visible only on This Week view
  document.getElementById('focus-data-link').classList.toggle(
    'hidden', !isMobile() || state.currentView !== 'this-week'
  );

  // "Clear all" button — visible when viewing completed tasks (desktop only; .header-actions is hidden on mobile)
  document.getElementById('clear-completed-btn').classList.toggle(
    'hidden', state.currentView !== 'completed' && !mobileShowCompleted
  );
}

// ─── Render: task list ────────────────────────────────────────────────────────

function getTasksForView() {
  const view = state.currentView;

  if (view === 'completed') {
    return { tasks: state.tasks.filter(t => t.done), isDraggable: false };
  }

  if (view === 'this-week') {
    return { tasks: state.tasks.filter(t => t.thisWeek && !t.done), isDraggable: true };
  }

  // mobileShowCompleted is only reachable on area/all views
  if (mobileShowCompleted) {
    const area = state.areas.find(a => a.id === view);
    const tasks = area
      ? state.tasks.filter(t => t.areaId === view && t.done)
      : state.tasks.filter(t => t.done);
    return { tasks, isDraggable: false };
  }

  if (view === 'all') {
    return { tasks: state.tasks.filter(t => !t.done), isDraggable: true };
  }

  const area = state.areas.find(a => a.id === view);
  if (area) {
    return { tasks: state.tasks.filter(t => t.areaId === view && !t.done), isDraggable: true };
  }

  return { tasks: [], isDraggable: false };
}

// Builds and appends a single task card to taskList.
// isDraggable, isCompleted, isAreaView are view-level flags passed explicitly
// so this function has no dependency on the renderTasks() closure.
function appendTaskCard(task, section, taskList, isDraggable, isCompleted, isAreaView) {
  const area = state.areas.find(a => a.id === task.areaId);
  const { borderColor } = getAreaColors(area);

  const card = document.createElement('div');
  card.className = 'task-card';
  card.style.borderLeftColor = borderColor;
  card.dataset.taskId = task.id;
  if (section) card.dataset.section = section;

  card.innerHTML = `
    <div class="task-card-main">
      <div class="task-card-content">
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-meta">${buildAreaTag(area)}</div>
      </div>
      ${!isCompleted && isDraggable ? '<div class="drag-handle"></div>' : ''}
    </div>
  `;

  if (isCompleted) {
    if (isMobile()) addSwipeLeft(card, () => showTaskDeletePopup(card, task.id));
  } else {
    card.classList.add('task-tappable');
    addTaskTapPopup(card, task);
    if (isMobile()) {
      if (!task.thisWeek) {
        addSwipeLeft(card, () => showTaskDeletePopup(card, task.id));
      } else {
        addSwipeLeft(card, () => showThisWeekPopup(card, task));
      }
    }
  }

  if (isDraggable && !isCompleted) {
    if (!isMobile()) addDragHandlers(card, task.id, 'task', section);
    addTouchDragHandlers(card, task.id, 'task', card.querySelector('.drag-handle'), section);
  }
  taskList.appendChild(card);
}

// Renders tasks split into "This Week" and "Later" sections (used for area and all-tasks views).
function appendSectionedTasks(tasks, habitsRendered, taskList, isDraggable, isCompleted, isAreaView) {
  const thisWeekTasks = tasks.filter(t => t.thisWeek);
  const otherTasks    = tasks.filter(t => !t.thisWeek);

  if (thisWeekTasks.length > 0) {
    taskList.appendChild(createSectionLabel('TASKS FOR THIS WEEK'));
    thisWeekTasks.forEach(t => appendTaskCard(t, 'thisweek', taskList, isDraggable, isCompleted, isAreaView));
  }

  if (otherTasks.length > 0) {
    if (habitsRendered || thisWeekTasks.length > 0) {
      taskList.appendChild(createSectionLabel('TASKS'));
    }
    otherTasks.forEach(t => appendTaskCard(t, 'other', taskList, isDraggable, isCompleted, isAreaView));
  }
}

function renderTasks() {
  const taskList   = document.getElementById('task-list');
  const emptyState = document.getElementById('empty-state');

  const { tasks, isDraggable } = getTasksForView();
  const isCompleted = state.currentView === 'completed' || mobileShowCompleted;
  const isAreaView  = !!state.areas.find(a => a.id === state.currentView) && !isCompleted;

  const prevProgressWidths = new Map();
  taskList.querySelectorAll('.habit-card[data-habit-id]').forEach(card => {
    const fill = card.querySelector('.habit-progress-fill');
    if (fill) prevProgressWidths.set(card.dataset.habitId, fill.style.width);
  });

  taskList.innerHTML = '';

  const habitsRendered = renderHabits(taskList, prevProgressWidths);

  if (habitsRendered && tasks.length > 0 && !state.areas.find(a => a.id === state.currentView) && state.currentView !== 'all') {
    taskList.appendChild(createSectionLabel('TASKS'));
  }

  if (!habitsRendered && tasks.length === 0) {
    const area = state.areas.find(a => a.id === state.currentView);
    const emptyText = state.currentView === 'this-week'
      ? 'Nothing planned for this week.'
      : area
        ? `No tasks in ${area.name} yet.`
        : 'Nothing here yet.';
    document.getElementById('empty-state-text').textContent = emptyText;
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
  }

  if (isAreaView || (state.currentView === 'all' && !mobileShowCompleted)) {
    appendSectionedTasks(tasks, habitsRendered, taskList, isDraggable, isCompleted, isAreaView);
  } else {
    tasks.forEach(t => appendTaskCard(t, null, taskList, isDraggable, isCompleted, isAreaView));
  }
}

// ─── Full render ──────────────────────────────────────────────────────────────

function render() {
  renderSidebar();
  updateViewHeader();
  renderTasks();
  if (isMobile() && !document.getElementById('areas-screen').classList.contains('hidden')) {
    renderAreasScreen();
  }
}

// ─── Task operations ──────────────────────────────────────────────────────────

function completeTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  const card = document.querySelector(`.task-card[data-task-id="${id}"]`);
  if (!card) {
    task.done = true;
    task.completedAt = new Date().toISOString();
    task.completedInWeek = getCurrentWeekKey();
    commit();
    return;
  }

  // Step 1: green flash
  card.classList.add('completing-flash');

  setTimeout(() => {
    // Step 2: collapse
    card.classList.add('completing-collapse');

    setTimeout(() => {
      // Animation done — update state and re-render
      task.done = true;
      task.completedAt = new Date().toISOString();
      task.completedInWeek = getCurrentWeekKey();
      commit();
    }, COMPLETE_COLLAPSE_MS);
  }, COMPLETE_FLASH_MS);
}

function toggleThisWeek(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.thisWeek = !task.thisWeek;
  commit();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  commit();
}

function clearCompleted() {
  const count = state.tasks.filter(t => t.done).length;
  if (count === 0) return;
  if (!confirm(`Delete all ${count} completed task${count > 1 ? 's' : ''}?`)) return;
  state.tasks = state.tasks.filter(t => !t.done);
  commit();
}

// ─── Area operations ──────────────────────────────────────────────────────────

function deleteArea(id) {
  const area = state.areas.find(a => a.id === id);
  if (!area) return;

  const taskCount = state.tasks.filter(t => t.areaId === id).length;

  if (taskCount > 0) {
    const confirmed = confirm(
      `"${area.name}" has ${taskCount} task${taskCount > 1 ? 's' : ''}.\nDeleting this area will also delete those tasks.\n\nContinue?`
    );
    if (!confirmed) return;
    state.tasks = state.tasks.filter(t => t.areaId !== id);
  }

  state.areas = state.areas.filter(a => a.id !== id);

  if (state.currentView === id) state.currentView = 'this-week';

  commit();
}

// ─── Habit operations ─────────────────────────────────────────────────────────

function incrementHabit(id) {
  const habit = state.habits.find(g => g.id === id);
  if (!habit) return;
  habit.count += 1;
  commit();
}

function decrementHabit(id) {
  const habit = state.habits.find(g => g.id === id);
  if (!habit || habit.count <= 0) return;
  habit.count -= 1;
  commit();
}

function deleteHabit(id) {
  state.habits = state.habits.filter(g => g.id !== id);
  commit();
}

// ─── New modal ────────────────────────────────────────────────────────────────

let preselectedAreaId = null;

function openNewModal(initialAreaId = null) {
  preselectedAreaId = initialAreaId;
  const defaultAreaId = initialAreaId || getDefaultAreaId();
  const defaultThisWeek = state.currentView === 'this-week';

  document.getElementById('new-title-input').value = '';
  document.getElementById('new-target-display').textContent = '1';
  document.getElementById('new-target-input').value = '1';

  // Area selector
  if (initialAreaId) {
    document.getElementById('new-area-select-group').classList.add('hidden');
    document.getElementById('new-area-pills-group').classList.add('hidden');
  } else if (isMobile()) {
    document.getElementById('new-area-select-group').classList.add('hidden');
    document.getElementById('new-area-pills-group').classList.remove('hidden');
    populateAreaPills('new-area-pills', defaultAreaId);
  } else {
    document.getElementById('new-area-select-group').classList.remove('hidden');
    document.getElementById('new-area-pills-group').classList.add('hidden');
    populateAreaSelect('new-area-select', defaultAreaId);
  }

  // Default toggle selection
  setNewToggle(defaultThisWeek ? 'this-week' : 'later');

  document.getElementById('new-modal').classList.remove('hidden');
  document.getElementById('new-title-input').focus();
}

function setNewToggle(type) {
  // type: 'this-week' | 'later' | 'habit'
  document.getElementById('new-toggle-this-week').classList.toggle('selected', type === 'this-week');
  document.getElementById('new-toggle-later').classList.toggle('selected', type === 'later');
  document.getElementById('new-toggle-habit').classList.toggle('selected', type === 'habit');

  const isHabit = type === 'habit';
  if (isMobile()) {
    document.getElementById('new-target-counter-group').classList.toggle('hidden', !isHabit);
    document.getElementById('new-target-input-group').classList.add('hidden');
  } else {
    document.getElementById('new-target-input-group').classList.toggle('hidden', !isHabit);
    document.getElementById('new-target-counter-group').classList.add('hidden');
  }
}

function getNewToggle() {
  if (document.getElementById('new-toggle-habit').classList.contains('selected')) return 'habit';
  if (document.getElementById('new-toggle-this-week').classList.contains('selected')) return 'this-week';
  return 'later';
}

function closeNewModal() {
  document.getElementById('new-modal').classList.add('hidden');
  preselectedAreaId = null;
}

function saveNew() {
  const title = document.getElementById('new-title-input').value.trim();
  if (!title) { document.getElementById('new-title-input').focus(); return; }

  const isHabit = getNewToggle() === 'habit';
  const areaId = preselectedAreaId || (isMobile() ? getSelectedAreaPill('new-area-pills') : document.getElementById('new-area-select').value);

  if (isHabit) {
    const target = isMobile()
      ? parseInt(document.getElementById('new-target-display').textContent, 10)
      : parseInt(document.getElementById('new-target-input').value, 10);
    if (!target || target < 1) return;
    state.habits.push({
      id: generateId(),
      title,
      areaId,
      target,
      count: 0,
      lastResetWeek: getCurrentWeekKey(),
    });
  } else {
    const thisWeek = getNewToggle() === 'this-week';
    state.tasks.push({
      id:          generateId(),
      title,
      areaId,
      thisWeek,
      done:        false,
      createdAt:   new Date().toISOString(),
      completedAt: null,
    });
  }

  closeNewModal();
  commit();
}

// ─── Drag-and-drop reordering ────────────────────────────────────────────────

let draggingItemId = null;

function addDragHandlers(card, itemId, type = 'task', section = null) {
  card.setAttribute('draggable', 'true');

  card.addEventListener('dragstart', (e) => {
    draggingItemId = itemId;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  card.addEventListener('dragend', () => {
    draggingItemId = null;
    card.classList.remove('dragging');
    document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
      el.classList.remove('drag-over-top', 'drag-over-bottom');
    });
  });

  card.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (draggingItemId === itemId) return;
    if (section && card.dataset.section !== section) return;
    const rect = card.getBoundingClientRect();
    const inTopHalf = e.clientY < rect.top + rect.height / 2;
    document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
      if (el !== card) el.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    card.classList.toggle('drag-over-top', inTopHalf);
    card.classList.toggle('drag-over-bottom', !inTopHalf);
    e.dataTransfer.dropEffect = 'move';
  });

  card.addEventListener('dragleave', (e) => {
    if (!card.contains(e.relatedTarget)) {
      card.classList.remove('drag-over-top', 'drag-over-bottom');
    }
  });

  card.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!draggingItemId || draggingItemId === itemId) return;
    if (section && card.dataset.section !== section) return;
    const insertBefore = card.classList.contains('drag-over-top');
    card.classList.remove('drag-over-top', 'drag-over-bottom');
    if (type === 'habit') reorderHabit(draggingItemId, itemId, insertBefore);
    else reorderTask(draggingItemId, itemId, insertBefore);
  });
}

function reorderItem(array, fromId, toId, insertBefore) {
  const fromIdx = array.findIndex(item => item.id === fromId);
  if (fromIdx === -1) return;
  const [moved] = array.splice(fromIdx, 1);
  const toIdx = array.findIndex(item => item.id === toId);
  if (toIdx === -1) { array.push(moved); return; }
  array.splice(insertBefore ? toIdx : toIdx + 1, 0, moved);
  commit();
}

function reorderTask(fromId, toId, insertBefore) {
  reorderItem(state.tasks, fromId, toId, insertBefore);
}

function reorderHabit(fromId, toId, insertBefore) {
  reorderItem(state.habits, fromId, toId, insertBefore);
}

// ─── Touch drag-and-drop ──────────────────────────────────────────────────────

function addTouchDragHandlers(card, itemId, type, handle, section = null) {
  let isDragging = false;
  let clone = null;
  let lastTarget = null;

  function getCards() {
    const all = type === 'task'
      ? [...document.querySelectorAll('.task-card[data-task-id]')]
      : [...document.querySelectorAll('.habit-card[data-habit-id]')];
    return section ? all.filter(c => c.dataset.section === section) : all;
  }

  function cleanup() {
    isDragging = false;
    if (clone) { clone.remove(); clone = null; }
    card.classList.remove('touch-dragging');
    document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
      el.classList.remove('drag-over-top', 'drag-over-bottom');
    });
  }

  // Drag activates immediately on handle touch — no delay needed
  if (handle) {
    handle.addEventListener('touchstart', () => {
      isDragging = true;
      card.classList.add('touch-dragging');
      clone = card.cloneNode(true);
      clone.style.cssText = `
        position: fixed;
        left: ${card.getBoundingClientRect().left}px;
        top: ${card.getBoundingClientRect().top}px;
        width: ${card.offsetWidth}px;
        opacity: 0.85;
        pointer-events: none;
        z-index: 1000;
        transform: scale(1.02);
        box-shadow: 0 8px 24px rgba(0,0,0,0.18);
        transition: none;
      `;
      document.body.appendChild(clone);
    }, { passive: true });
  }

  card.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    e.preventDefault();

    const touch = e.touches[0];

    // Move clone with finger
    if (clone) {
      clone.style.left = (touch.clientX - card.offsetWidth / 2) + 'px';
      clone.style.top  = (touch.clientY - card.offsetHeight / 2) + 'px';
    }

    // Find card under finger
    clone.style.display = 'none';
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    clone.style.display = '';

    const targetCard = el && el.closest(type === 'task' ? '.task-card' : '.habit-card');
    const targetId   = targetCard && (type === 'task'
      ? targetCard.dataset.taskId
      : targetCard.dataset.habitId);

    if (targetCard && targetId && targetId !== itemId) {
      lastTarget = { id: targetId, card: targetCard };
      const rect = targetCard.getBoundingClientRect();
      const inTopHalf = touch.clientY < rect.top + rect.height / 2;
      getCards().forEach(c => {
        if (c !== targetCard) c.classList.remove('drag-over-top', 'drag-over-bottom');
      });
      targetCard.classList.toggle('drag-over-top', inTopHalf);
      targetCard.classList.toggle('drag-over-bottom', !inTopHalf);
    } else if (!targetCard) {
      getCards().forEach(c => c.classList.remove('drag-over-top', 'drag-over-bottom'));
      lastTarget = null;
    }
  }, { passive: false });

  function onTouchEnd() {
    if (!isDragging) return;

    if (lastTarget) {
      const insertBefore = lastTarget.card.classList.contains('drag-over-top');
      if (type === 'task') {
        reorderTask(itemId, lastTarget.id, insertBefore);
      } else {
        reorderHabit(itemId, lastTarget.id, insertBefore);
      }
    }

    cleanup();
    lastTarget = null;
  }

  card.addEventListener('touchend',    onTouchEnd);
  card.addEventListener('touchcancel', cleanup);
}

// ─── Area selector helpers ────────────────────────────────────────────────────

function populateAreaSelect(selectId, selectedAreaId) {
  const select = document.getElementById(selectId);
  select.innerHTML = state.areas
    .map(a => `<option value="${a.id}" ${a.id === selectedAreaId ? 'selected' : ''}>${escapeHtml(a.name)}</option>`)
    .join('');
}

function populateAreaPills(containerId, selectedAreaId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  state.areas.forEach(area => {
    const { tagBg, tagColor } = getAreaColors(area);
    const pill = document.createElement('button');
    pill.className = 'area-pill' + (area.id === selectedAreaId ? ' selected' : '');
    pill.dataset.areaId = area.id;
    pill.style.background = tagBg;
    pill.style.color = tagColor;
    pill.textContent = area.name;
    pill.addEventListener('click', () => {
      container.querySelectorAll('.area-pill').forEach(p => p.classList.remove('selected'));
      pill.classList.add('selected');
    });
    container.appendChild(pill);
  });
}

function getSelectedAreaPill(containerId) {
  const selected = document.querySelector(`#${containerId} .area-pill.selected`);
  return selected ? selected.dataset.areaId : (state.areas[0]?.id || null);
}

// ─── Swipe left to action ────────────────────────────────────────────────────

function addSwipeLeft(card, onSwipe) {
  let startX = 0;
  let startY = 0;
  let swiping = false;
  let swipeCommitted = false;
  const THRESHOLD = SWIPE_THRESHOLD_PX;

  card.addEventListener('touchstart', (e) => {
    if (e.target.closest('.drag-handle')) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    swiping = false;
    swipeCommitted = false;
  }, { passive: true });

  card.addEventListener('touchmove', (e) => {
    if (e.target.closest('.drag-handle')) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    // Determine direction on first meaningful move
    if (!swiping && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;

    if (!swiping) {
      // If more vertical than horizontal, not a swipe — bail
      if (Math.abs(dy) > Math.abs(dx)) return;
      swiping = true;
    }

    if (dx < 0) {
      e.preventDefault();
      const clamped = Math.max(dx, -THRESHOLD * 1.5);
      card.style.transform = `translateX(${clamped}px)`;
      card.style.transition = 'none';
    }
  }, { passive: false });

  card.addEventListener('touchend', (e) => {
    if (!swiping) return;
    const dx = e.changedTouches[0].clientX - startX;

    card.style.transition = 'transform 0.2s ease';
    card.style.transform = 'translateX(0)';

    if (dx < -THRESHOLD && !swipeCommitted) {
      swipeCommitted = true;
      // Small delay so snap-back is visible before popup appears
      setTimeout(() => onSwipe(), 150);
    }

    swiping = false;
  });

  card.addEventListener('touchcancel', () => {
    card.style.transition = 'transform 0.2s ease';
    card.style.transform = 'translateX(0)';
    swiping = false;
  });
}


// ─── Touch long-press helper ─────────────────────────────────────────────────

// Fires callback after delayMs of continuous touch on el.
// onBeforeStart(e) is called on touchstart — return false to cancel the timer.
function addTouchLongPress(el, callback, delayMs, onBeforeStart = null) {
  let holdTimer = null;
  el.addEventListener('touchstart', (e) => {
    if (onBeforeStart && onBeforeStart(e) === false) return;
    holdTimer = setTimeout(() => { holdTimer = null; callback(); }, delayMs);
  }, { passive: true });
  el.addEventListener('touchend',    () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } });
  el.addEventListener('touchcancel', () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } });
  el.addEventListener('touchmove',   () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } }, { passive: true });
}

// ─── Inline card popup builder ───────────────────────────────────────────────

// Creates a popup overlay with a label, a confirm button, and a cancel button.
// label/confirmText are treated as HTML — escape any user-supplied content before passing.
function createInlinePopup(label, confirmText, confirmClass, onConfirm) {
  const popup = document.createElement('div');
  popup.innerHTML = `
    <div class="popup-inner">
      <span class="popup-label">${label}</span>
      <button class="${confirmClass}">${confirmText}</button>
      <button class="popup-cancel">Cancel</button>
    </div>
  `;
  popup.querySelector(`.${confirmClass}`).addEventListener('click', (e) => {
    e.stopPropagation();
    popup.remove();
    onConfirm();
  });
  popup.querySelector('.popup-cancel').addEventListener('click', (e) => {
    e.stopPropagation();
    popup.remove();
  });
  return popup;
}

// ─── Task swipe delete popup ─────────────────────────────────────────────────

function showTaskDeletePopup(card, taskId) {
  card.querySelector('.task-delete-popup')?.remove();
  const popup = createInlinePopup('Delete task?', 'Delete', 'popup-confirm-red', () => deleteTask(taskId));
  popup.className = 'task-delete-popup';
  card.appendChild(popup);
}

// ─── Habit swipe delete popup ─────────────────────────────────────────────────

function showHabitDeletePopup(card, habitId) {
  card.querySelector('.habit-delete-popup')?.remove();
  const popup = createInlinePopup('Delete habit?', 'Delete', 'popup-confirm-red', () => deleteHabit(habitId));
  popup.className = 'habit-delete-popup';
  card.appendChild(popup);
}

// ─── This Week long-press popup ──────────────────────────────────────────────

function showThisWeekPopup(card, task) {
  card.querySelector('.thisweek-popup')?.remove();
  const label       = task.thisWeek ? 'Remove from This Week?' : 'Add to This Week?';
  const actionLabel = task.thisWeek ? 'Remove' : 'Add';
  const confirmClass = task.thisWeek ? 'popup-confirm-red' : 'confirm-green';
  const popup = createInlinePopup(label, actionLabel, confirmClass, () => toggleThisWeek(task.id));
  popup.className = 'thisweek-popup';
  card.appendChild(popup);
}

// ─── Task tap popup (complete) ────────────────────────────────────────────────

function addTaskTapPopup(card, task) {
  card.addEventListener('click', (e) => {
    if (e.target.closest('.drag-handle')) return;
    if (e.target.closest('.task-complete-popup')) return;
    if (e.target.closest('.thisweek-popup')) return;
    if (card.querySelector('.task-complete-popup') || card.querySelector('.thisweek-popup')) return;
    if (task.thisWeek) {
      showTaskCompletePopup(card, task);
    } else {
      showThisWeekPopup(card, task);
    }
  });
}

function showTaskCompletePopup(card, task) {
  const popup = createInlinePopup('Complete task?', 'Complete', 'confirm-green', () => completeTask(task.id));
  popup.className = 'task-complete-popup';
  card.appendChild(popup);
}

// ─── Habit tap popup (counter) ────────────────────────────────────────────────

function addHabitTapPopup(card, habit) {
  card.addEventListener('click', (e) => {
    if (e.target.closest('.drag-handle')) return;
    if (e.target.closest('.habit-delete-popup')) return;
    if (e.target.closest('.habit-counter-popup')) return;
    if (card._longPressActive) { card._longPressActive = false; return; }
    if (card.querySelector('.habit-counter-popup')) return;
    showHabitCounterPopup(card, habit);
  });
}

function showHabitCounterPopup(card, habit) {
  const popup = document.createElement('div');
  popup.className = 'habit-counter-popup';

  function getHabit() { return state.habits.find(g => g.id === habit.id); }

  function updateDisplay() {
    const g = getHabit();
    if (!g) return;
    popup.querySelector('.popup-count').textContent = `${g.count} / ${g.target}`;
    popup.querySelector('.popup-decrement').disabled = g.count <= 0;
    popup.querySelector('.popup-increment').disabled = g.count >= g.target;
  }

  const g = getHabit();
  if (!g) return;
  const originalCount = g.count;
  popup.innerHTML = `
    <div class="popup-inner">
      <button class="counter-btn popup-decrement" ${g.count <= 0 ? 'disabled' : ''}>−</button>
      <span class="popup-count counter-display">${g.count} / ${g.target}</span>
      <button class="counter-btn popup-increment" ${g.count >= g.target ? 'disabled' : ''}>+</button>
      <button class="confirm-green" style="margin-left:auto;">Confirm</button>
      <button class="popup-cancel">Cancel</button>
    </div>
  `;

  popup.querySelector('.popup-decrement').addEventListener('click', (e) => {
    e.stopPropagation();
    const g = getHabit();
    if (g && g.count > 0) { g.count--; updateDisplay(); }
  });
  popup.querySelector('.popup-increment').addEventListener('click', (e) => {
    e.stopPropagation();
    const g = getHabit();
    if (g && g.count < g.target) { g.count++; updateDisplay(); }
  });
  popup.querySelector('.confirm-green').addEventListener('click', (e) => {
    e.stopPropagation();
    saveState();
    popup.remove();
    render();
  });
  popup.querySelector('.popup-cancel').addEventListener('click', (e) => {
    e.stopPropagation();
    const g = getHabit();
    if (g) g.count = originalCount;
    popup.remove();
    render();
  });

  card.appendChild(popup);
}

// ─── Weekly review modal ──────────────────────────────────────────────────────

function showWeeklyReviewModal(stats) {
  document.getElementById('weekly-habits-stat').textContent =
    `${stats.accomplishedHabits} / ${stats.totalHabits}`;
  document.getElementById('weekly-tasks-stat').textContent =
    `${stats.thisWeekTasksDone} / ${stats.thisWeekTasksTotal}`;

  const hasIncomplete = stats.incompleteThisWeekIds.length > 0;
  document.getElementById('weekly-review-remove').classList.toggle('hidden', !hasIncomplete);
  document.getElementById('weekly-review-question').textContent = hasIncomplete
    ? 'Keep unfinished tasks in This Week?'
    : 'Ready for next week?';
  document.getElementById('weekly-review-keep').textContent = hasIncomplete ? 'Keep' : "Let's go!";

  document.getElementById('weekly-review-modal').classList.remove('hidden');
}

function closeWeeklyReviewModal() {
  document.getElementById('weekly-review-modal').classList.add('hidden');
}

function removeIncompleteFromWeek(ids) {
  ids.forEach(id => {
    const task = state.tasks.find(t => t.id === id);
    if (task) task.thisWeek = false;
  });
  commit();
}

// ─── Export / Import ─────────────────────────────────────────────────────────

function openDataMenu() {
  document.getElementById('data-menu').classList.remove('hidden');
  document.getElementById('data-menu-overlay').classList.remove('hidden');
}

function closeDataMenu() {
  document.getElementById('data-menu').classList.add('hidden');
  document.getElementById('data-menu-overlay').classList.add('hidden');
}

function exportData() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    areas: state.areas,
    tasks: state.tasks,
    habits: state.habits,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `focus-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  closeDataMenu();
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.areas || !data.tasks || !(data.habits || data.goals)) {
        alert('Invalid backup file.');
        return;
      }
      if (!confirm(`This will replace all your current data with the backup from ${data.exportedAt ? data.exportedAt.slice(0,10) : 'unknown date'}. Continue?`)) return;
      state.areas = data.areas;
      state.tasks = data.tasks;
      state.habits = data.habits || data.goals; // data.goals: backward compat with old backups
      commit();
      closeDataMenu();
    } catch {
      alert('Could not read file. Make sure it\'s a valid focus. backup.');
    }
  };
  reader.readAsText(file);
}

function addDataMenuLongPress(el) {
  addTouchLongPress(el, openDataMenu, LONG_PRESS_DATA_MS);
  // Desktop: long mousedown
  let holdTimer = null;
  el.addEventListener('mousedown',  () => { holdTimer = setTimeout(() => { holdTimer = null; openDataMenu(); }, LONG_PRESS_DATA_MS); });
  el.addEventListener('mouseup',    () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } });
  el.addEventListener('mouseleave', () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } });
}

// ─── Area delete popup ────────────────────────────────────────────────────────

function showAreaDeletePopup(areaId, areaName, anchorCard) {
  document.getElementById('area-delete-popup')?.remove();
  const taskCount = state.tasks.filter(t => t.areaId === areaId).length;
  const label = taskCount > 0
    ? `Delete "${escapeHtml(areaName)}"? (${taskCount} task${taskCount > 1 ? 's' : ''} will be deleted)`
    : `Delete "${escapeHtml(areaName)}"?`;
  const popup = createInlinePopup(label, 'Delete', 'popup-confirm-red', () => deleteArea(areaId));
  popup.id = 'area-delete-popup';
  popup.className = 'area-delete-popup';
  anchorCard.appendChild(popup);
}

// ─── Area modal ───────────────────────────────────────────────────────────────

function openAddArea() {
  document.getElementById('area-name-input').value = '';
  document.getElementById('area-modal').classList.remove('hidden');
  document.getElementById('area-name-input').focus();
}

function closeAreaModal() {
  document.getElementById('area-modal').classList.add('hidden');
}

function saveArea() {
  const name = document.getElementById('area-name-input').value.trim();
  if (!name) {
    document.getElementById('area-name-input').focus();
    return;
  }

  const newArea = { id: generateId(), name, color: pickNextColor() };
  state.areas.push(newArea);

  closeAreaModal();
  commit();

  // On mobile, refresh the areas screen immediately if it's open
  if (isMobile() && !document.getElementById('areas-screen').classList.contains('hidden')) {
    renderAreasScreen();
  }
}

// ─── Mobile navigation ────────────────────────────────────────────────────────

// Tracks whether the completed tab is active on mobile
let mobileShowCompleted = false;

function showAreasScreen() {
  document.getElementById('areas-screen').classList.remove('hidden');
  renderAreasScreen();
}

function hideAreasScreen() {
  document.getElementById('areas-screen').classList.add('hidden');
}

function renderAreasScreen() {
  const list = document.getElementById('areas-screen-list');
  list.innerHTML = '';

  // Area rows — styled as cards
  state.areas.forEach(area => {
    const card = document.createElement('div');
    card.className = 'area-screen-card';
    card.style.borderLeftColor = area.color;
    card.innerHTML = `<span class="area-screen-card-name">${escapeHtml(area.name)}</span>`;

    // Quick tap animation then navigate (skip if delete popup is open)
    card.addEventListener('click', () => {
      if (card.querySelector('.area-delete-popup')) return;
      card.classList.add('area-card-tapped');
      setTimeout(() => {
        hideAreasScreen();
        navigateTo(area.id);
      }, 80);
    });

    addSwipeLeft(card, () => showAreaDeletePopup(area.id, area.name, card));

    list.appendChild(card);
  });

  // Add area — card style, extra spacing
  const addBtn = document.createElement('div');
  addBtn.className = 'area-screen-card area-screen-card-add';
  addBtn.innerHTML = `<span class="area-screen-card-name">+ Add area</span>`;
  addBtn.addEventListener('click', openAddArea);
  list.appendChild(addBtn);

}

function updateMobileBottomNav(view) {
  document.getElementById('mobile-nav-this-week').classList.toggle('active', view === 'this-week');
  document.getElementById('mobile-nav-areas').classList.toggle('active',
    view !== 'this-week' && view !== 'all'
  );
}

function updateBackBtn(view) {
  const backBtn = document.getElementById('back-btn');
  const isArea = state.areas.find(a => a.id === view);
  const isAll  = view === 'all';
  if ((isArea || isAll || mobileShowCompleted) && isMobile()) {
    backBtn.classList.remove('hidden');
  } else {
    backBtn.classList.add('hidden');
  }
}

// ─── Voice input ─────────────────────────────────────────────────────────────
//
// Flow: long-press + → hold to record (Web Speech API) → release → LLM
// interpretation → existing modal prefilled → user confirms.
// No auto-creation; no conversational UI.

let voiceState = 'idle';   // 'idle' | 'recording' | 'processing'
let voiceRec   = null;     // active SpeechRecognition instance
let voiceText  = '';       // transcript from current recording

function voiceSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function getStoredApiKey() {
  return localStorage.getItem(VOICE_API_KEY_STORE) || null;
}

function ensureApiKey() {
  const key = getStoredApiKey();
  if (key) return key;
  const entered = prompt(
    'Enter your Anthropic API key to enable voice input.\n' +
    'It is stored only in your browser (localStorage) and sent only to api.anthropic.com.'
  );
  if (entered && entered.trim()) {
    localStorage.setItem(VOICE_API_KEY_STORE, entered.trim());
    return entered.trim();
  }
  return null;
}

// ─── Voice overlay & toast ────────────────────────────────────────────────────

function showVoiceOverlay() {
  document.getElementById('voice-overlay').classList.remove('hidden');
}

function hideVoiceOverlay() {
  document.getElementById('voice-overlay').classList.add('hidden');
  document.getElementById('voice-mic').classList.remove('speaking');
  document.getElementById('voice-listening-text').textContent = 'Listening…';
}

let voiceToastTimer = null;

function showVoiceToast(msg, persist = false) {
  const el = document.getElementById('voice-toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(voiceToastTimer);
  if (!persist) {
    voiceToastTimer = setTimeout(() => el.classList.add('hidden'), 2500);
  }
}

function hideVoiceToast() {
  clearTimeout(voiceToastTimer);
  document.getElementById('voice-toast').classList.add('hidden');
}

// ─── Recording lifecycle ──────────────────────────────────────────────────────

function startVoiceRecording() {
  if (voiceState !== 'idle') return;

  if (!voiceSupported()) {
    showVoiceToast('Voice input requires Chrome or Safari');
    return;
  }

  const apiKey = ensureApiKey();
  if (!apiKey) return;

  voiceState = 'recording';
  voiceText  = '';
  showVoiceOverlay();

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  voiceRec = new SR();
  voiceRec.interimResults  = false;
  voiceRec.maxAlternatives = 1;
  voiceRec.lang            = navigator.language || 'en-US';

  voiceRec.onspeechstart = () => {
    document.getElementById('voice-mic').classList.add('speaking');
    document.getElementById('voice-listening-text').textContent = 'Got it…';
  };

  voiceRec.onspeechend = () => {
    document.getElementById('voice-mic').classList.remove('speaking');
    document.getElementById('voice-listening-text').textContent = 'Listening…';
  };

  voiceRec.onresult = (e) => {
    voiceText = Array.from(e.results)
      .map(r => r[0].transcript)
      .join(' ')
      .trim();
  };

  voiceRec.onerror = (e) => {
    if (voiceState !== 'recording') return;
    voiceState = 'idle';
    hideVoiceOverlay();
    voiceRec = null;
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      showVoiceToast('Microphone access denied');
    } else if (e.error === 'no-speech') {
      showVoiceToast('No speech detected');
    } else {
      showVoiceToast('Could not record audio');
    }
  };

  voiceRec.onend = () => {
    if (voiceState !== 'recording') return;
    voiceState = 'idle';
    hideVoiceOverlay();
    const transcript = voiceText.trim();
    voiceRec = null;
    if (!transcript) {
      showVoiceToast('No speech detected');
      return;
    }
    processVoiceTranscript(transcript);
  };

  try {
    voiceRec.start();
  } catch (_) {
    voiceState = 'idle';
    hideVoiceOverlay();
    voiceRec = null;
    showVoiceToast('Could not start recording');
  }
}

function stopVoiceRecording() {
  if (voiceState !== 'recording' || !voiceRec) return;
  try { voiceRec.stop(); } catch (_) {}
}

// ─── Transcript → modal ───────────────────────────────────────────────────────

async function processVoiceTranscript(transcript) {
  voiceState = 'processing';
  showVoiceToast('Processing…', true);

  const apiKey = getStoredApiKey();
  if (!apiKey) {
    hideVoiceToast();
    voiceState = 'idle';
    openNewModal();
    return;
  }

  try {
    const raw        = await interpretWithLLM(transcript, apiKey);
    const parsed     = parseModelResponse(raw);
    const normalized = normalizeVoiceData(parsed);
    hideVoiceToast();
    voiceState = 'idle';
    openNewModalPrefilled(normalized);
  } catch (err) {
    hideVoiceToast();
    voiceState = 'idle';
    if (err.message === 'invalid-key') {
      localStorage.removeItem(VOICE_API_KEY_STORE);
      showVoiceToast('Invalid API key — re-enter on next try');
    } else {
      showVoiceToast('Could not interpret speech');
      openNewModal();
    }
  }
}

// ─── LLM call ─────────────────────────────────────────────────────────────────

async function interpretWithLLM(transcript, apiKey) {
  const areaNames = state.areas.map(a => a.name).join(', ');

  const systemPrompt =
`You are a task parser for a minimal personal task manager. Convert one spoken phrase into a structured entry.

Output EXACTLY these 4 lines — nothing before, nothing after, no commentary, no questions:
title: <short action-oriented title, max ${TITLE_MAX_LENGTH} chars>
focus_area: <one of: ${areaNames}>
type: <one of: habit, later, this week>
weekly_target: <false or a positive integer>

Rules:
- title: short, imperative, strip filler words ("I should", "I need to", "probably", etc.)
- title: if multiple unrelated tasks are present, output exactly: MULTIPLE
- title: if the input is past-tense or non-actionable ("I already did X", "I am tired"), output exactly: NON_ACTIONABLE
- focus_area: best match from the provided list; fallback to Misc if nothing fits
- type: "habit" for recurring activities; "this week" for current/urgent one-offs; "later" for future one-offs
- weekly_target: only a positive integer when type is habit AND a clear frequency is stated (e.g. "3 times a week" → 3, "every day" → 7, "on weekdays" → 5); otherwise false`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: `Transcript: "${transcript}"` }],
    }),
  });

  if (!resp.ok) {
    if (resp.status === 401) throw new Error('invalid-key');
    throw new Error(`api-error-${resp.status}`);
  }

  const data = await resp.json();
  return data.content[0].text;
}

// ─── Response parsing & normalization ────────────────────────────────────────

function parseModelResponse(text) {
  const out = { title: '', focus_area: '', type: '', weekly_target: '' };
  for (const line of text.split('\n')) {
    const m = line.match(/^([a-z_]+)\s*:\s*(.+)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    if (key in out) out[key] = m[2].trim();
  }
  return out;
}

function normalizeVoiceData(parsed) {
  // Special sentinel titles
  const rawTitle = (parsed.title || '').trim();
  if (rawTitle === 'MULTIPLE')      return { title: null, _reason: 'multiple' };
  if (rawTitle === 'NON_ACTIONABLE') return { title: null, _reason: 'non-actionable' };

  // Type — map to toggle values used by setNewToggle()
  let type = (parsed.type || '').toLowerCase().trim();
  if (type === 'this week') type = 'this-week';
  if (!['habit', 'later', 'this-week'].includes(type)) type = 'later';

  // Weekly target — only valid for habits
  let weeklyTarget = false;
  if (type === 'habit') {
    const wt = String(parsed.weekly_target || '').toLowerCase().trim();
    if (wt !== 'false' && wt !== '') {
      const n = parseInt(wt, 10);
      if (!isNaN(n) && n >= 1) weeklyTarget = n;
    }
  }

  // Title — truncate at word boundary if over limit
  let title = rawTitle;
  if (title.length > TITLE_MAX_LENGTH) {
    title = title.slice(0, TITLE_MAX_LENGTH).replace(/\s+\S*$/, '').trim();
  }

  // Area — case-insensitive name match; fallback to Misc, then first area
  const areaName = (parsed.focus_area || '').trim().toLowerCase();
  let area = state.areas.find(a => a.name.toLowerCase() === areaName);
  if (!area) area = state.areas.find(a => a.name.toLowerCase() === 'misc');
  if (!area) area = state.areas[0];
  const areaId = area ? area.id : null;

  return { title, areaId, type, weeklyTarget };
}

// ─── Prefilled modal ──────────────────────────────────────────────────────────

function openNewModalPrefilled(data) {
  if (!data.title) {
    if (data._reason === 'multiple') {
      showVoiceToast('Please say one task or habit at a time');
    } else {
      showVoiceToast('Could not detect an actionable item');
    }
    return;
  }

  // Open with normal defaults first (populates area selector DOM)
  openNewModal(null);

  // Override title
  document.getElementById('new-title-input').value = data.title;

  // Override type toggle (also shows/hides target inputs)
  setNewToggle(data.type || 'later');

  // Override area selection
  if (data.areaId) {
    if (isMobile()) {
      document.querySelectorAll('#new-area-pills .area-pill').forEach(p => {
        p.classList.toggle('selected', p.dataset.areaId === data.areaId);
      });
    } else {
      document.getElementById('new-area-select').value = data.areaId;
    }
  }

  // Override weekly target when applicable
  if (data.type === 'habit' && data.weeklyTarget) {
    document.getElementById('new-target-display').textContent = String(data.weeklyTarget);
    document.getElementById('new-target-input').value         = String(data.weeklyTarget);
  }

  // Cursor to end of title so user can append/edit naturally
  const inp = document.getElementById('new-title-input');
  inp.setSelectionRange(inp.value.length, inp.value.length);
}

// ─── Long-press wiring ────────────────────────────────────────────────────────

function initVoiceLongPress() {
  if (!voiceSupported()) return;  // silently skip; normal tap still works

  // mouseup anywhere on document stops recording (finger/mouse may drift off button)
  document.addEventListener('mouseup', () => {
    if (voiceState === 'recording') stopVoiceRecording();
  });

  function attachVoiceLongPress(btn) {
    let holdTimer      = null;
    let longPressFired = false;

    function clearHold() {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    }

    function armTimer() {
      clearHold();
      longPressFired = false;
      holdTimer = setTimeout(() => {
        holdTimer      = null;
        longPressFired = true;
        startVoiceRecording();
      }, VOICE_LONG_PRESS_MS);
    }

    // Touch
    btn.addEventListener('touchstart',  armTimer,  { passive: true });
    btn.addEventListener('touchend',    () => { clearHold(); if (voiceState === 'recording') stopVoiceRecording(); });
    btn.addEventListener('touchcancel', () => { clearHold(); longPressFired = false; if (voiceState === 'recording') stopVoiceRecording(); });
    btn.addEventListener('touchmove',   clearHold, { passive: true });

    // Mouse
    btn.addEventListener('mousedown',  armTimer);
    btn.addEventListener('mouseup',    clearHold);   // recording stopped by document handler
    btn.addEventListener('mouseleave', clearHold);   // timer cancelled; recording continues until mouseup

    // Capture-phase click: suppress after long-press so openNewModal() doesn't fire
    btn.addEventListener('click', (e) => {
      if (longPressFired || voiceState === 'processing') {
        e.stopImmediatePropagation();
        longPressFired = false;
      }
    }, true);
  }

  attachVoiceLongPress(document.getElementById('add-new-btn'));
  attachVoiceLongPress(document.getElementById('mobile-nav-add'));
}

// ─── Event wiring (runs once on DOMContentLoaded) ─────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  render();

  // Weekly review modal
  document.getElementById('weekly-review-keep').addEventListener('click', closeWeeklyReviewModal);
  document.getElementById('weekly-review-overlay').addEventListener('click', closeWeeklyReviewModal);
  document.getElementById('weekly-review-remove').addEventListener('click', () => {
    const ids = weeklyReviewStats ? weeklyReviewStats.incompleteThisWeekIds : [];
    closeWeeklyReviewModal();
    removeIncompleteFromWeek(ids);
  });

  if (weeklyReviewStats) {
    showWeeklyReviewModal(weeklyReviewStats);
  }

  // Static sidebar nav
  document.getElementById('nav-this-week').addEventListener('click', () => navigateTo('this-week'));
  document.getElementById('nav-all').addEventListener('click',       () => navigateTo('all'));
  document.getElementById('nav-completed').addEventListener('click', () => navigateTo('completed'));

  // Add new / area
  document.getElementById('add-new-btn').addEventListener('click', () => openNewModal());
  document.getElementById('add-area-btn').addEventListener('click', openAddArea);

  // Header action buttons (static elements, toggled by updateViewHeader)
  document.getElementById('completed-link').addEventListener('click', () => { mobileShowCompleted = true; render(); });
  document.getElementById('focus-data-link').addEventListener('click', openDataMenu);
  document.getElementById('clear-completed-btn').addEventListener('click', clearCompleted);

  // New modal (unified task + habit)
  document.getElementById('new-modal-cancel').addEventListener('click', closeNewModal);
  document.getElementById('new-modal-save').addEventListener('click', saveNew);
  document.getElementById('new-modal-overlay').addEventListener('click', closeNewModal);
  document.getElementById('new-title-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveNew();
    if (e.key === 'Escape') closeNewModal();
  });
  document.getElementById('new-toggle-this-week').addEventListener('click', () => setNewToggle('this-week'));
  document.getElementById('new-toggle-later').addEventListener('click', () => setNewToggle('later'));
  document.getElementById('new-toggle-habit').addEventListener('click', () => setNewToggle('habit'));
  document.getElementById('new-target-increment').addEventListener('click', () => {
    const display = document.getElementById('new-target-display');
    display.textContent = parseInt(display.textContent) + 1;
  });
  document.getElementById('new-target-decrement').addEventListener('click', () => {
    const display = document.getElementById('new-target-display');
    const val = parseInt(display.textContent);
    if (val > 1) display.textContent = val - 1;
  });
  // Area modal
  document.getElementById('area-modal-cancel').addEventListener('click', closeAreaModal);
  document.getElementById('area-modal-save').addEventListener('click', saveArea);
  document.getElementById('area-modal-overlay').addEventListener('click', closeAreaModal);
  document.getElementById('area-name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveArea();
    if (e.key === 'Escape') closeAreaModal();
  });

  // Mobile: bottom nav
  document.getElementById('mobile-nav-this-week').addEventListener('click', () => {
    hideAreasScreen();
    navigateTo('this-week');
  });
  document.getElementById('mobile-all-tasks').addEventListener('click', () => {
    hideAreasScreen();
    navigateTo('all');
  });

  document.getElementById('mobile-nav-areas').addEventListener('click', () => {
    showAreasScreen();
    document.getElementById('mobile-nav-areas').classList.add('active');
    document.getElementById('mobile-nav-this-week').classList.remove('active');
  });
  document.getElementById('mobile-nav-add').addEventListener('click', () => openNewModal());

  // Mobile: back button
  document.getElementById('back-btn').addEventListener('click', () => {
    if (mobileShowCompleted) {
      mobileShowCompleted = false;
      updateBackBtn(state.currentView);
      render();
    } else {
      showAreasScreen();
      updateMobileBottomNav('areas');
      document.getElementById('back-btn').classList.add('hidden');
    }
  });

  // Long-press on "focus." title (desktop only) → data menu
  addDataMenuLongPress(document.querySelector('.app-name'));

  // Long-press on + buttons → voice recording
  initVoiceLongPress();

  // Data menu
  document.getElementById('data-export').addEventListener('click', exportData);
  document.getElementById('data-import').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
  });
  document.getElementById('import-file-input').addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('data-menu-overlay').addEventListener('click', closeDataMenu);

});
