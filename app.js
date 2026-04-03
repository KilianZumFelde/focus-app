// ─── Color generation for areas ──────────────────────────────────────────────
// Spreads hues evenly around the color wheel using a golden angle offset
// so consecutive areas are always maximally distinct.
// Fixed saturation + lightness keeps all colors soft/pastel.

const GOLDEN_ANGLE = 137.508; // degrees — produces maximally spread hues

function generateAreaColor(index) {
  const hue = (200 + index * GOLDEN_ANGLE) % 360;
  return `hsl(${Math.round(hue)}, 45%, 78%)`;
}

function pickNextColor() {
  return generateAreaColor(state.areas.length);
}

// ─── Default state ────────────────────────────────────────────────────────────

const DEFAULT_STATE = {
  areas: [
    { id: 'a1', name: 'Finances', color: generateAreaColor(0) },
    { id: 'a2', name: 'Health',   color: generateAreaColor(1) },
    { id: 'a3', name: 'Social',   color: generateAreaColor(2) },
    { id: 'a4', name: 'Job',      color: generateAreaColor(3) },
    { id: 'a5', name: 'Misc',     color: generateAreaColor(4) },
  ],
  tasks: [],
  goals: [],
  currentView: 'this-week',
};

// ─── State ────────────────────────────────────────────────────────────────────

let state = JSON.parse(JSON.stringify(DEFAULT_STATE));

function loadState() {
  try {
    const saved = localStorage.getItem('focus-app-v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      state = { ...DEFAULT_STATE, ...parsed };
    }
  } catch (e) {
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
  resetGoalsIfNewWeek();
}

function saveState() {
  localStorage.setItem('focus-app-v1', JSON.stringify(state));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Returns the date string of Monday of the current week (e.g. "2026-03-30")
function getCurrentWeekKey() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function resetGoalsIfNewWeek() {
  const weekKey = getCurrentWeekKey();
  let changed = false;
  state.goals.forEach(goal => {
    if (goal.lastResetWeek !== weekKey) {
      goal.count = 0;
      goal.lastResetWeek = weekKey;
      changed = true;
    }
  });
  if (changed) saveState();
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

function setView(view) {
  state.currentView = view;
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
      <button class="area-delete-btn" data-area-id="${area.id}" title="Delete area" tabindex="-1">×</button>
    `;

    btn.addEventListener('click', (e) => {
      if (e.target.closest('.area-delete-btn')) return;
      setView(area.id);
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

// ─── Render: goals ───────────────────────────────────────────────────────────

function getGoalsForView() {
  if (state.currentView === 'this-week') return state.goals;
  if (state.areas.find(a => a.id === state.currentView)) {
    return state.goals.filter(g => g.areaId === state.currentView);
  }
  return [];
}

function renderGoals(taskList) {
  const goals = getGoalsForView();
  if (goals.length === 0) return false;

  const isLabelledView = state.currentView === 'this-week' || state.areas.find(a => a.id === state.currentView);
  if (isLabelledView) {
    const goalsLabel = document.createElement('span');
    goalsLabel.className = 'section-label';
    goalsLabel.textContent = 'GOALS';
    taskList.appendChild(goalsLabel);
  }

  goals.forEach(goal => {
    const area = state.areas.find(a => a.id === goal.areaId);
    const { borderColor } = getAreaColors(area);
    const isDone = goal.count >= goal.target;

    const card = document.createElement('div');
    card.className = 'goal-card' + (isDone ? ' goal-done' : '');
    card.style.borderLeftColor = borderColor;
    card.dataset.goalId = goal.id;

    card.innerHTML = `
      <div class="goal-card-main">
        <div class="goal-card-content">
          <div class="goal-title-row">
            <span class="goal-icon">↻</span>
            <span class="goal-title">${escapeHtml(goal.title)}</span>
          </div>
          <div class="task-meta">${buildAreaTag(area)}</div>
        </div>
        <div class="goal-counter">
          <button class="counter-btn decrement-btn" data-goal-id="${goal.id}" ${goal.count <= 0 ? 'disabled' : ''}>−</button>
          <span class="counter-display">${goal.count} / ${goal.target}</span>
          <button class="counter-btn increment-btn" data-goal-id="${goal.id}">+</button>
        </div>
        <div class="goal-card-actions">
          <button class="action-btn edit-goal-btn" data-goal-id="${goal.id}" title="Edit">✎</button>
          <button class="action-btn delete-btn delete-goal-btn" data-goal-id="${goal.id}" title="Delete">×</button>
        </div>
      </div>
    `;

    taskList.appendChild(card);
  });

  // Counter listeners
  taskList.querySelectorAll('.increment-btn').forEach(btn => {
    btn.addEventListener('click', () => incrementGoal(btn.dataset.goalId));
  });
  taskList.querySelectorAll('.decrement-btn').forEach(btn => {
    btn.addEventListener('click', () => decrementGoal(btn.dataset.goalId));
  });
  taskList.querySelectorAll('.edit-goal-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditGoal(btn.dataset.goalId));
  });
  taskList.querySelectorAll('.delete-goal-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteGoal(btn.dataset.goalId));
  });

  return true;
}

// ─── Render: task list ────────────────────────────────────────────────────────

function renderTasks() {
  const taskList    = document.getElementById('task-list');
  const emptyState  = document.getElementById('empty-state');
  const viewTitle   = document.getElementById('view-title');
  const addTaskBtn  = document.getElementById('add-task-btn');
  const addGoalBtn  = document.getElementById('add-goal-btn');

  let tasks = [];
  let title = '';
  let isDraggable = false;

  if (state.currentView === 'this-week') {
    title = 'This Week';
    tasks = state.tasks.filter(t => t.thisWeek && !t.done);
    isDraggable = true;
    addTaskBtn.classList.remove('hidden');
    addGoalBtn.classList.remove('hidden');
  } else if (state.currentView === 'all') {
    title = 'All Tasks';
    tasks = state.tasks.filter(t => !t.done);
    addTaskBtn.classList.remove('hidden');
    addGoalBtn.classList.add('hidden');
  } else if (state.currentView === 'completed') {
    title = 'Completed';
    tasks = state.tasks.filter(t => t.done);
    addTaskBtn.classList.add('hidden');
    addGoalBtn.classList.add('hidden');
  } else {
    const area = state.areas.find(a => a.id === state.currentView);
    if (area) {
      title = area.name;
      // On mobile, respect completed toggle
      if (isMobile() && mobileShowCompleted) {
        tasks = state.tasks.filter(t => t.areaId === area.id && t.done);
      } else {
        tasks = state.tasks.filter(t => t.areaId === area.id && !t.done);
        isDraggable = true;
      }
    }
    addTaskBtn.classList.remove('hidden');
    addGoalBtn.classList.remove('hidden');
  }

  // Mobile: All Tasks with completed toggle
  if (isMobile() && state.currentView === 'all') {
    if (mobileShowCompleted) {
      tasks = state.tasks.filter(t => t.done);
    } else {
      tasks = state.tasks.filter(t => !t.done);
    }
  }

  viewTitle.textContent = title;
  taskList.innerHTML = '';

  const goalsRendered = renderGoals(taskList);

  if (goalsRendered && tasks.length > 0) {
    const tasksLabel = document.createElement('span');
    tasksLabel.className = 'section-label';
    tasksLabel.textContent = 'TASKS';
    taskList.appendChild(tasksLabel);
  }

  if (!goalsRendered && tasks.length === 0) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
  }

  tasks.forEach(task => {
    const area = state.areas.find(a => a.id === task.areaId);
    const { borderColor } = getAreaColors(area);

    const card = document.createElement('div');
    card.className = 'task-card';
    card.style.borderLeftColor = borderColor;
    card.dataset.taskId = task.id;

    const isCompleted = state.currentView === 'completed';

    card.innerHTML = `
      <div class="task-card-main">
        <div class="task-card-content">
          <div class="task-title">${escapeHtml(task.title)}</div>
          ${task.description
            ? `<div class="task-desc">${escapeHtml(task.description)}</div>`
            : ''}
          <div class="task-meta">${buildAreaTag(area)}</div>
        </div>
        <div class="task-card-actions">
          ${!isCompleted ? `
            <button class="action-btn thisweek-btn ${task.thisWeek ? 'active' : ''}"
              data-task-id="${task.id}"
              title="${task.thisWeek ? 'Remove from This Week' : 'Add to This Week'}">
              ${task.thisWeek ? '◈' : '◇'}
            </button>
            <button class="action-btn edit-btn" data-task-id="${task.id}" title="Edit">✎</button>
            <button class="action-btn complete-btn" data-task-id="${task.id}" title="Mark as done">✓</button>
          ` : `
            <button class="action-btn delete-btn" data-task-id="${task.id}" title="Delete permanently">×</button>
          `}
        </div>
      </div>
    `;

    if (isDraggable) addDragHandlers(card, task.id);
    taskList.appendChild(card);
  });

  // Attach task action listeners
  taskList.querySelectorAll('.thisweek-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleThisWeek(btn.dataset.taskId));
  });
  taskList.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditTask(btn.dataset.taskId));
  });
  taskList.querySelectorAll('.complete-btn').forEach(btn => {
    btn.addEventListener('click', () => completeTask(btn.dataset.taskId));
  });
  taskList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteTask(btn.dataset.taskId));
  });
}

// ─── Full render ──────────────────────────────────────────────────────────────

function render() {
  renderSidebar();
  renderTasks();
}

// ─── Task operations ──────────────────────────────────────────────────────────

function completeTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  const card = document.querySelector(`.task-card[data-task-id="${id}"]`);
  if (!card) {
    task.done = true;
    task.completedAt = new Date().toISOString();
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
      commit();
    }, 300);
  }, 300);
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

// ─── Goal operations ──────────────────────────────────────────────────────────

function incrementGoal(id) {
  const goal = state.goals.find(g => g.id === id);
  if (!goal) return;
  goal.count += 1;
  commit();
}

function decrementGoal(id) {
  const goal = state.goals.find(g => g.id === id);
  if (!goal || goal.count <= 0) return;
  goal.count -= 1;
  commit();
}

function deleteGoal(id) {
  state.goals = state.goals.filter(g => g.id !== id);
  commit();
}

// ─── Goal modal ───────────────────────────────────────────────────────────────

let editingGoalId = null;


function openAddGoal() {
  editingGoalId = null;
  const defaultAreaId = getDefaultAreaId();
  document.getElementById('goal-modal-title').textContent = 'New goal';
  document.getElementById('goal-title-input').value = '';
  document.getElementById('goal-target-input').value = '1';
  populateAreaSelect('goal-area-select', defaultAreaId);
  document.getElementById('goal-modal').classList.remove('hidden');
  document.getElementById('goal-title-input').focus();
}

function openEditGoal(id) {
  const goal = state.goals.find(g => g.id === id);
  if (!goal) return;
  editingGoalId = id;
  document.getElementById('goal-modal-title').textContent = 'Edit goal';
  document.getElementById('goal-title-input').value = goal.title;
  document.getElementById('goal-target-input').value = goal.target;
  populateAreaSelect('goal-area-select', goal.areaId);
  document.getElementById('goal-modal').classList.remove('hidden');
  document.getElementById('goal-title-input').focus();
}

function closeGoalModal() {
  document.getElementById('goal-modal').classList.add('hidden');
  editingGoalId = null;
}

function saveGoal() {
  const title  = document.getElementById('goal-title-input').value.trim();
  const target = parseInt(document.getElementById('goal-target-input').value, 10);
  if (!title) { document.getElementById('goal-title-input').focus(); return; }
  if (!target || target < 1) { document.getElementById('goal-target-input').focus(); return; }
  const areaId = document.getElementById('goal-area-select').value;

  if (editingGoalId) {
    const goal = state.goals.find(g => g.id === editingGoalId);
    if (goal) { goal.title = title; goal.target = target; goal.areaId = areaId; }
  } else {
    state.goals.push({
      id: generateId(),
      title,
      areaId,
      target,
      count: 0,
      lastResetWeek: getCurrentWeekKey(),
    });
  }

  closeGoalModal();
  commit();
}

// ─── Drag-and-drop reordering ────────────────────────────────────────────────

let draggingTaskId = null;

function addDragHandlers(card, taskId) {
  card.setAttribute('draggable', 'true');

  card.addEventListener('dragstart', (e) => {
    draggingTaskId = taskId;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  card.addEventListener('dragend', () => {
    draggingTaskId = null;
    card.classList.remove('dragging');
    document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
      el.classList.remove('drag-over-top', 'drag-over-bottom');
    });
  });

  card.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (draggingTaskId === taskId) return;
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
    if (!draggingTaskId || draggingTaskId === taskId) return;
    const insertBefore = card.classList.contains('drag-over-top');
    card.classList.remove('drag-over-top', 'drag-over-bottom');
    reorderTask(draggingTaskId, taskId, insertBefore);
  });
}

function reorderTask(fromId, toId, insertBefore) {
  const fromIdx = state.tasks.findIndex(t => t.id === fromId);
  if (fromIdx === -1) return;
  const [moved] = state.tasks.splice(fromIdx, 1);
  const toIdx = state.tasks.findIndex(t => t.id === toId);
  if (toIdx === -1) { state.tasks.push(moved); return; }
  state.tasks.splice(insertBefore ? toIdx : toIdx + 1, 0, moved);
  commit();
}

// ─── Task modal ───────────────────────────────────────────────────────────────

let editingTaskId = null;

function populateAreaSelect(selectId, selectedAreaId) {
  const select = document.getElementById(selectId);
  select.innerHTML = state.areas
    .map(a => `<option value="${a.id}" ${a.id === selectedAreaId ? 'selected' : ''}>${escapeHtml(a.name)}</option>`)
    .join('');
}

function openAddTask() {
  editingTaskId = null;

  // Default area: current area view, otherwise first area
  const defaultAreaId = getDefaultAreaId();

  document.getElementById('modal-title').textContent = 'New task';
  document.getElementById('task-title-input').value = '';
  document.getElementById('task-desc-input').value = '';
  document.getElementById('task-thisweek-check').checked = state.currentView === 'this-week';
  populateAreaSelect('task-area-select', defaultAreaId);

  document.getElementById('task-modal').classList.remove('hidden');
  document.getElementById('task-title-input').focus();
}

function openEditTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  editingTaskId = id;

  document.getElementById('modal-title').textContent = 'Edit task';
  document.getElementById('task-title-input').value = task.title;
  document.getElementById('task-desc-input').value = task.description || '';
  document.getElementById('task-thisweek-check').checked = task.thisWeek;
  populateAreaSelect('task-area-select', task.areaId);

  document.getElementById('task-modal').classList.remove('hidden');
  document.getElementById('task-title-input').focus();
}

function closeTaskModal() {
  document.getElementById('task-modal').classList.add('hidden');
  editingTaskId = null;
}

function saveTask() {
  const title = document.getElementById('task-title-input').value.trim();
  if (!title) {
    document.getElementById('task-title-input').focus();
    return;
  }

  const areaId      = document.getElementById('task-area-select').value;
  const description = document.getElementById('task-desc-input').value.trim();
  const thisWeek    = document.getElementById('task-thisweek-check').checked;

  if (editingTaskId) {
    const task = state.tasks.find(t => t.id === editingTaskId);
    if (task) {
      task.title       = title;
      task.description = description;
      task.areaId      = areaId;
      task.thisWeek    = thisWeek;
    }
  } else {
    state.tasks.push({
      id:          generateId(),
      title,
      description,
      areaId,
      thisWeek,
      done:        false,
      createdAt:   new Date().toISOString(),
      completedAt: null,
    });
  }

  closeTaskModal();
  commit();
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
}

// ─── Mobile navigation ────────────────────────────────────────────────────────

const isMobile = () => window.innerWidth <= 768;

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

  // Area rows
  state.areas.forEach(area => {
    const btn = document.createElement('button');
    btn.className = 'area-screen-row';
    btn.innerHTML = `
      <span class="area-color-dot" style="background:${area.color}"></span>
      <span>${escapeHtml(area.name)}</span>
      <span class="area-screen-chevron">›</span>
    `;
    btn.addEventListener('click', () => {
      hideAreasScreen();
      setMobileView(area.id);
    });
    list.appendChild(btn);
  });

  // Add area
  const addBtn = document.createElement('button');
  addBtn.className = 'area-screen-add';
  addBtn.innerHTML = `<span>+ Add area</span>`;
  addBtn.addEventListener('click', openAddArea);
  list.appendChild(addBtn);

}

function setMobileView(view) {
  mobileShowCompleted = false;
  state.currentView = view;
  updateMobileBottomNav(view);
  updateBackBtn(view);
  updateCompletedToggle(view);
  render();
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
  if ((isArea || isAll) && isMobile()) {
    backBtn.classList.remove('hidden');
  } else {
    backBtn.classList.add('hidden');
  }
}

function updateCompletedToggle(view) {
  const toggle = document.getElementById('completed-toggle');
  if (!isMobile()) return;
  const showToggle = view === 'all' || state.areas.find(a => a.id === view);
  toggle.classList.toggle('hidden', !showToggle);
  document.getElementById('toggle-open').classList.toggle('active', !mobileShowCompleted);
  document.getElementById('toggle-done').classList.toggle('active', mobileShowCompleted);
}

function openAddActionMenu() {
  document.getElementById('add-action-menu').classList.remove('hidden');
  document.getElementById('add-action-overlay').classList.remove('hidden');
}

function closeAddActionMenu() {
  document.getElementById('add-action-menu').classList.add('hidden');
  document.getElementById('add-action-overlay').classList.add('hidden');
}

// ─── Event wiring (runs once on DOMContentLoaded) ─────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  render();

  // Static sidebar nav
  document.getElementById('nav-this-week').addEventListener('click', () => setView('this-week'));
  document.getElementById('nav-all').addEventListener('click',       () => setView('all'));
  document.getElementById('nav-completed').addEventListener('click', () => setView('completed'));

  // Add task / area / goal
  document.getElementById('add-task-btn').addEventListener('click', openAddTask);
  document.getElementById('add-area-btn').addEventListener('click', openAddArea);
  document.getElementById('add-goal-btn').addEventListener('click', openAddGoal);

  // Goal modal
  document.getElementById('goal-modal-cancel').addEventListener('click', closeGoalModal);
  document.getElementById('goal-modal-save').addEventListener('click', saveGoal);
  document.getElementById('goal-modal-overlay').addEventListener('click', closeGoalModal);
  document.getElementById('goal-title-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveGoal();
    if (e.key === 'Escape') closeGoalModal();
  });
  document.getElementById('goal-target-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveGoal();
    if (e.key === 'Escape') closeGoalModal();
  });

  // Task modal
  document.getElementById('modal-cancel').addEventListener('click', closeTaskModal);
  document.getElementById('modal-save').addEventListener('click', saveTask);
  document.getElementById('task-modal-overlay').addEventListener('click', closeTaskModal);
  document.getElementById('task-title-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveTask();
    if (e.key === 'Escape') closeTaskModal();
  });
  document.getElementById('task-desc-input').addEventListener('keydown', e => {
    if (e.key === 'Escape') closeTaskModal();
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
    setMobileView('this-week');
  });
  document.getElementById('mobile-all-tasks').addEventListener('click', () => {
    hideAreasScreen();
    setMobileView('all');
  });

  document.getElementById('mobile-nav-areas').addEventListener('click', () => {
    showAreasScreen();
    document.getElementById('mobile-nav-areas').classList.add('active');
    document.getElementById('mobile-nav-this-week').classList.remove('active');
  });
  document.getElementById('mobile-nav-add').addEventListener('click', openAddActionMenu);

  // Mobile: + action menu
  document.getElementById('mobile-add-task').addEventListener('click', () => {
    closeAddActionMenu();
    openAddTask();
  });
  document.getElementById('mobile-add-goal').addEventListener('click', () => {
    closeAddActionMenu();
    openAddGoal();
  });
  document.getElementById('add-action-overlay').addEventListener('click', closeAddActionMenu);

  // Mobile: back button
  document.getElementById('back-btn').addEventListener('click', () => {
    showAreasScreen();
    updateMobileBottomNav('areas');
  });

  // Mobile: completed toggle
  document.getElementById('toggle-open').addEventListener('click', () => {
    mobileShowCompleted = false;
    updateCompletedToggle(state.currentView);
    render();
  });
  document.getElementById('toggle-done').addEventListener('click', () => {
    mobileShowCompleted = true;
    updateCompletedToggle(state.currentView);
    render();
  });

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
});
