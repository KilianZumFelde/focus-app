// ─── Debug flags ─────────────────────────────────────────────────────────────
const DEBUG_WEEKLY_REVIEW = false; // set true to force weekly review modal on every load

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
    { id: 'a1', name: 'Career',  color: generateAreaColor(0) },
    { id: 'a2', name: 'Health',  color: generateAreaColor(1) },
    { id: 'a3', name: 'Music',   color: generateAreaColor(2) },
    { id: 'a4', name: 'Bachata', color: generateAreaColor(3) },
    { id: 'a5', name: 'Misc',    color: generateAreaColor(4) },
  ],
  tasks: [],
  goals: [],
  currentView: 'this-week',
};

// ─── State ────────────────────────────────────────────────────────────────────

let state = JSON.parse(JSON.stringify(DEFAULT_STATE));

let pendingWeeklyStats = null;

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
  pendingWeeklyStats = resetGoalsIfNewWeek();
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
  let stats = null;

  const needsReset = state.goals.some(g => g.lastResetWeek !== weekKey);
  const alreadyShown = localStorage.getItem('focus-weekly-review-shown') === weekKey;

  if (needsReset || DEBUG_WEEKLY_REVIEW) {
    // Capture last week's stats before resetting
    const totalGoals = state.goals.length;
    const accomplishedGoals = state.goals.filter(g => g.count >= g.target).length;
    const thisWeekTasks = state.tasks.filter(t => t.thisWeek && !t.done);
    const thisWeekTasksDone = state.tasks.filter(t => t.thisWeek && t.done).length;
    const thisWeekTasksTotal = thisWeekTasks.length + thisWeekTasksDone;
    const incompleteThisWeekIds = thisWeekTasks.map(t => t.id);

    const hasSomethingToShow = totalGoals > 0 || thisWeekTasksTotal > 0;

    if (hasSomethingToShow && (!alreadyShown || DEBUG_WEEKLY_REVIEW)) {
      stats = {
        accomplishedGoals,
        totalGoals,
        thisWeekTasksDone,
        thisWeekTasksTotal,
        incompleteThisWeekIds,
      };
    }

    // Reset goals
    state.goals.forEach(goal => {
      if (goal.lastResetWeek !== weekKey) {
        goal.count = 0;
        goal.lastResetWeek = weekKey;
        changed = true;
      }
    });

    if (!DEBUG_WEEKLY_REVIEW) {
      localStorage.setItem('focus-weekly-review-shown', weekKey);
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
  if (state.currentView === 'all') return state.goals;
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
    goalsLabel.textContent = 'HABITS';
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
            <span class="goal-title">${escapeHtml(goal.title)}</span>
          </div>
          <div class="task-meta">${buildAreaTag(area)}</div>
        </div>
        <span class="counter-display${isDone ? ' counter-done' : ''}">${isDone ? '✓ ' : ''}${goal.count} / ${goal.target}</span>
        <div class="drag-handle"></div>
      </div>
    `;

    if (!isDone) addGoalTapPopup(card, goal);
    if (isMobile()) addSwipeLeft(card, () => showGoalDeletePopup(card, goal.id));
    addTouchDragHandlers(card, goal.id, 'goal', card.querySelector('.drag-handle'));
    taskList.appendChild(card);
  });

  return true;
}

// ─── Render: task list ────────────────────────────────────────────────────────

function renderTasks() {
  const taskList    = document.getElementById('task-list');
  const emptyState  = document.getElementById('empty-state');
  const viewTitle   = document.getElementById('view-title');
  const addNewBtn   = document.getElementById('add-new-btn');

  let tasks = [];
  let title = '';
  let isDraggable = false;

  if (state.currentView === 'this-week') {
    title = 'This Week';
    tasks = state.tasks.filter(t => t.thisWeek && !t.done);
    isDraggable = true;
    addNewBtn.classList.remove('hidden');
  } else if (state.currentView === 'all') {
    title = 'All Tasks & Habits';
    tasks = state.tasks.filter(t => !t.done);
    isDraggable = true;
    addNewBtn.classList.remove('hidden');
  } else if (state.currentView === 'completed') {
    title = 'Completed';
    tasks = state.tasks.filter(t => t.done);
    addNewBtn.classList.add('hidden');
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
    addNewBtn.classList.remove('hidden');
  }

  // Mobile: All Tasks with completed toggle
  if (isMobile() && state.currentView === 'all') {
    if (mobileShowCompleted) {
      tasks = state.tasks.filter(t => t.done);
    } else {
      tasks = state.tasks.filter(t => !t.done);
    }
  }

  // On mobile: show "Completed" link in header for area/all views,
  // or a back link when viewing completed inside an area
  const completedLink = document.getElementById('completed-link');
  if (completedLink) completedLink.remove();

  if (isMobile()) {
    const isAreaOrAll = state.currentView === 'all' || state.areas.find(a => a.id === state.currentView);
    if (isAreaOrAll && !mobileShowCompleted) {
      const link = document.createElement('button');
      link.id = 'completed-link';
      link.className = 'completed-header-link';
      link.textContent = 'Completed ›';
      link.addEventListener('click', () => {
        mobileShowCompleted = true;
        render();
      });
      document.querySelector('.header-left').appendChild(link);
    }
  }

  if (mobileShowCompleted) {
    title += ' — Completed';
  }

  viewTitle.textContent = title;

  // Mobile: "focus." tap link in This Week header
  const existingFocusLink = document.getElementById('focus-data-link');
  if (existingFocusLink) existingFocusLink.remove();
  if (isMobile() && state.currentView === 'this-week') {
    const focusLink = document.createElement('button');
    focusLink.id = 'focus-data-link';
    focusLink.className = 'completed-header-link';
    focusLink.textContent = 'focus.';
    focusLink.addEventListener('click', openDataMenu);
    document.querySelector('.header-left').appendChild(focusLink);
  }

  // Show "Clear all" button in header when viewing completed tasks
  const existingClear = document.getElementById('clear-completed-btn');
  if (existingClear) existingClear.remove();
  const isShowingCompleted = state.currentView === 'completed' || mobileShowCompleted;
  if (isShowingCompleted) {
    const clearBtn = document.createElement('button');
    clearBtn.id = 'clear-completed-btn';
    clearBtn.className = 'clear-completed-btn';
    clearBtn.textContent = 'Clear all';
    clearBtn.addEventListener('click', clearCompleted);
    document.querySelector('.header-actions').appendChild(clearBtn);
  }

  taskList.innerHTML = '';

  const goalsRendered = renderGoals(taskList);

  if (goalsRendered && tasks.length > 0 && !state.areas.find(a => a.id === state.currentView) && state.currentView !== 'all') {
    const tasksLabel = document.createElement('span');
    tasksLabel.className = 'section-label';
    tasksLabel.textContent = 'TASKS';
    taskList.appendChild(tasksLabel);
  }

  if (!goalsRendered && tasks.length === 0) {
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

  const isCompleted = state.currentView === 'completed' || mobileShowCompleted;
  const isAreaView = !!state.areas.find(a => a.id === state.currentView) && !isCompleted;

  function appendTaskCard(task, section) {
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
        if (isAreaView && !task.thisWeek) {
          // Area view, not in week: swipe = delete, hold = add to week
          addSwipeLeft(card, () => showTaskDeletePopup(card, task.id));
          addThisWeekLongPress(card, task);
        } else {
          // This Week view or already-in-week task: swipe = remove from week
          addSwipeLeft(card, () => showThisWeekPopup(card, task));
        }
      }
    }

    if (isDraggable && !isCompleted) {
      if (!isMobile()) addDragHandlers(card, task.id, section);
      addTouchDragHandlers(card, task.id, 'task', card.querySelector('.drag-handle'), section);
    }
    taskList.appendChild(card);
  }

  if (isAreaView) {
    const thisWeekTasks = tasks.filter(t => t.thisWeek);
    const otherTasks    = tasks.filter(t => !t.thisWeek);

    if (thisWeekTasks.length > 0) {
      const label = document.createElement('span');
      label.className = 'section-label';
      label.textContent = 'TASKS FOR THIS WEEK';
      taskList.appendChild(label);
      thisWeekTasks.forEach(t => appendTaskCard(t, 'thisweek'));
    }

    if (otherTasks.length > 0) {
      if (goalsRendered || thisWeekTasks.length > 0) {
        const label = document.createElement('span');
        label.className = 'section-label';
        label.textContent = 'TASKS';
        taskList.appendChild(label);
      }
      otherTasks.forEach(t => appendTaskCard(t, 'other'));
    }

  } else if (state.currentView === 'all' && !mobileShowCompleted) {
    const thisWeekTasks = tasks.filter(t => t.thisWeek);
    const otherTasks    = tasks.filter(t => !t.thisWeek);

    if (thisWeekTasks.length > 0) {
      const label = document.createElement('span');
      label.className = 'section-label';
      label.textContent = 'TASKS FOR THIS WEEK';
      taskList.appendChild(label);
      thisWeekTasks.forEach(t => appendTaskCard(t, 'thisweek'));
    }

    if (otherTasks.length > 0) {
      if (goalsRendered || thisWeekTasks.length > 0) {
        const label = document.createElement('span');
        label.className = 'section-label';
        label.textContent = 'TASKS';
        taskList.appendChild(label);
      }
      otherTasks.forEach(t => appendTaskCard(t, 'other'));
    }

  } else {
    tasks.forEach(t => appendTaskCard(t, null));
  }
}

// ─── Full render ──────────────────────────────────────────────────────────────

function render() {
  renderSidebar();
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

// ─── New modal ────────────────────────────────────────────────────────────────

let fixedModalAreaId = null;

function openNewModal(fixedAreaId = null) {
  fixedModalAreaId = fixedAreaId;
  const defaultAreaId = fixedAreaId || getDefaultAreaId();
  const defaultThisWeek = state.currentView === 'this-week';

  document.getElementById('new-title-input').value = '';
  document.getElementById('new-target-display').textContent = '1';
  document.getElementById('new-target-input').value = '1';

  // Area selector
  if (fixedAreaId) {
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
  fixedModalAreaId = null;
}

function saveNew() {
  const title = document.getElementById('new-title-input').value.trim();
  if (!title) { document.getElementById('new-title-input').focus(); return; }

  const isGoal = getNewToggle() === 'habit';
  const areaId = fixedModalAreaId || (isMobile() ? getSelectedAreaPill('new-area-pills') : document.getElementById('new-area-select').value);

  if (isGoal) {
    const target = isMobile()
      ? parseInt(document.getElementById('new-target-display').textContent, 10)
      : parseInt(document.getElementById('new-target-input').value, 10);
    if (!target || target < 1) return;
    state.goals.push({
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

let draggingTaskId = null;

function addDragHandlers(card, taskId, section = null) {
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
    if (!draggingTaskId || draggingTaskId === taskId) return;
    if (section && card.dataset.section !== section) return;
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

function reorderGoal(fromId, toId, insertBefore) {
  const fromIdx = state.goals.findIndex(g => g.id === fromId);
  if (fromIdx === -1) return;
  const [moved] = state.goals.splice(fromIdx, 1);
  const toIdx = state.goals.findIndex(g => g.id === toId);
  if (toIdx === -1) { state.goals.push(moved); return; }
  state.goals.splice(insertBefore ? toIdx : toIdx + 1, 0, moved);
  commit();
}

// ─── Touch drag-and-drop ──────────────────────────────────────────────────────

function addTouchDragHandlers(card, itemId, type, handle, section = null) {
  let isDragging = false;
  let clone = null;
  let lastTarget = null;

  function getCards() {
    const all = type === 'task'
      ? [...document.querySelectorAll('.task-card[data-task-id]')]
      : [...document.querySelectorAll('.goal-card[data-goal-id]')];
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

    const targetCard = el && el.closest(type === 'task' ? '.task-card' : '.goal-card');
    const targetId   = targetCard && (type === 'task'
      ? targetCard.dataset.taskId
      : targetCard.dataset.goalId);

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
        reorderGoal(itemId, lastTarget.id, insertBefore);
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
  const THRESHOLD = 60;

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


// ─── Task swipe delete popup ─────────────────────────────────────────────────

function showTaskDeletePopup(card, taskId) {
  const existing = card.querySelector('.goal-delete-popup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.className = 'goal-delete-popup';
  popup.innerHTML = `
    <div class="area-delete-popup-inner">
      <span class="area-delete-label">Delete task?</span>
      <button class="area-delete-confirm">Delete</button>
      <button class="area-delete-cancel">Cancel</button>
    </div>
  `;
  popup.querySelector('.area-delete-confirm').addEventListener('click', (e) => {
    e.stopPropagation();
    popup.remove();
    deleteTask(taskId);
  });
  popup.querySelector('.area-delete-cancel').addEventListener('click', (e) => {
    e.stopPropagation();
    popup.remove();
  });
  card.appendChild(popup);
}

// ─── Goal long-press delete popup ────────────────────────────────────────────

function showGoalDeletePopup(card, goalId) {
  const existing = card.querySelector('.goal-delete-popup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.className = 'goal-delete-popup';
  popup.innerHTML = `
    <div class="area-delete-popup-inner">
      <span class="area-delete-label">Delete habit?</span>
      <button class="area-delete-confirm">Delete</button>
      <button class="area-delete-cancel">Cancel</button>
    </div>
  `;
  popup.querySelector('.area-delete-confirm').addEventListener('click', (e) => {
    e.stopPropagation();
    popup.remove();
    deleteGoal(goalId);
  });
  popup.querySelector('.area-delete-cancel').addEventListener('click', (e) => {
    e.stopPropagation();
    popup.remove();
  });
  card.appendChild(popup);
}

// ─── This Week long-press popup ──────────────────────────────────────────────

function addThisWeekLongPress(card, task) {
  let holdTimer = null;

  card.addEventListener('touchstart', (e) => {
    if (e.target.closest('.drag-handle')) return;
    card._longPressActive = false;
    holdTimer = setTimeout(() => {
      holdTimer = null;
      card._longPressActive = true;
      showThisWeekPopup(card, task);
    }, 600);
  }, { passive: true });

  card.addEventListener('touchend', () => {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  });
  card.addEventListener('touchcancel', () => {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  });
  card.addEventListener('touchmove', () => {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  }, { passive: true });
}

function showThisWeekPopup(card, task) {
  const existing = card.querySelector('.thisweek-popup');
  if (existing) existing.remove();

  const label = task.thisWeek ? 'Remove from This Week?' : 'Add to This Week?';
  const actionLabel = task.thisWeek ? 'Remove' : 'Add';

  const popup = document.createElement('div');
  popup.className = 'thisweek-popup';
  const confirmClass = task.thisWeek ? 'area-delete-confirm' : 'confirm-green';
  popup.innerHTML = `
    <div class="area-delete-popup-inner">
      <span class="area-delete-label">${label}</span>
      <button class="${confirmClass}">${actionLabel}</button>
      <button class="area-delete-cancel">Cancel</button>
    </div>
  `;

  popup.querySelector(`.${confirmClass}`).addEventListener('click', (e) => {
    e.stopPropagation();
    popup.remove();
    toggleThisWeek(task.id);
  });
  popup.querySelector('.area-delete-cancel').addEventListener('click', (e) => {
    e.stopPropagation();
    popup.remove();
  });

  card.appendChild(popup);
}

// ─── Task tap popup (complete) ────────────────────────────────────────────────

function addTaskTapPopup(card, task) {
  card.addEventListener('click', (e) => {
    if (e.target.closest('.drag-handle')) return;
    if (e.target.closest('.task-complete-popup')) return;
    if (e.target.closest('.thisweek-popup')) return;
    if (card._longPressActive) { card._longPressActive = false; return; }
    if (card.querySelector('.task-complete-popup')) return;
    showTaskCompletePopup(card, task);
  });
}

function showTaskCompletePopup(card, task) {
  const popup = document.createElement('div');
  popup.className = 'task-complete-popup';
  popup.innerHTML = `
    <div class="area-delete-popup-inner">
      <span class="area-delete-label">Complete task?</span>
      <button class="confirm-green">Complete</button>
      <button class="area-delete-cancel">Cancel</button>
    </div>
  `;
  popup.querySelector('.confirm-green').addEventListener('click', (e) => {
    e.stopPropagation();
    popup.remove();
    completeTask(task.id);
  });
  popup.querySelector('.area-delete-cancel').addEventListener('click', (e) => {
    e.stopPropagation();
    popup.remove();
  });
  card.appendChild(popup);
}

// ─── Goal tap popup (counter) ─────────────────────────────────────────────────

function addGoalTapPopup(card, goal) {
  card.addEventListener('click', (e) => {
    if (e.target.closest('.drag-handle')) return;
    if (e.target.closest('.goal-delete-popup')) return;
    if (e.target.closest('.goal-counter-popup')) return;
    if (card._longPressActive) { card._longPressActive = false; return; }
    if (card.querySelector('.goal-counter-popup')) return;
    showGoalCounterPopup(card, goal);
  });
}

function showGoalCounterPopup(card, goal) {
  const popup = document.createElement('div');
  popup.className = 'goal-counter-popup';

  function getGoal() { return state.goals.find(g => g.id === goal.id); }

  function updateDisplay() {
    const g = getGoal();
    if (!g) return;
    popup.querySelector('.popup-count').textContent = `${g.count} / ${g.target}`;
    popup.querySelector('.popup-decrement').disabled = g.count <= 0;
    popup.querySelector('.popup-increment').disabled = g.count >= g.target;
  }

  const g = getGoal();
  if (!g) return;
  popup.innerHTML = `
    <div class="area-delete-popup-inner">
      <button class="counter-btn popup-decrement" ${g.count <= 0 ? 'disabled' : ''}>−</button>
      <span class="popup-count counter-display">${g.count} / ${g.target}</span>
      <button class="counter-btn popup-increment" ${g.count >= g.target ? 'disabled' : ''}>+</button>
      <button class="confirm-green" style="margin-left:auto;">Done</button>
    </div>
  `;

  popup.querySelector('.popup-decrement').addEventListener('click', (e) => {
    e.stopPropagation();
    const g = getGoal();
    if (g && g.count > 0) { g.count--; saveState(); updateDisplay(); }
  });
  popup.querySelector('.popup-increment').addEventListener('click', (e) => {
    e.stopPropagation();
    const g = getGoal();
    if (g && g.count < g.target) { g.count++; saveState(); updateDisplay(); }
  });
  popup.querySelector('.confirm-green').addEventListener('click', (e) => {
    e.stopPropagation();
    popup.remove();
    render();
  });

  card.appendChild(popup);
}

// ─── Weekly review modal ──────────────────────────────────────────────────────

function showWeeklyReviewModal(stats) {
  document.getElementById('weekly-goals-stat').textContent =
    `${stats.accomplishedGoals} / ${stats.totalGoals}`;
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
    goals: state.goals,
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
      if (!data.areas || !data.tasks || !data.goals) {
        alert('Invalid backup file.');
        return;
      }
      if (!confirm(`This will replace all your current data with the backup from ${data.exportedAt ? data.exportedAt.slice(0,10) : 'unknown date'}. Continue?`)) return;
      state.areas = data.areas;
      state.tasks = data.tasks;
      state.goals = data.goals;
      commit();
      closeDataMenu();
    } catch {
      alert('Could not read file. Make sure it\'s a valid focus. backup.');
    }
  };
  reader.readAsText(file);
}

function addDataMenuLongPress(el) {
  let holdTimer = null;
  el.addEventListener('touchstart', () => {
    holdTimer = setTimeout(() => { holdTimer = null; openDataMenu(); }, 800);
  }, { passive: true });
  el.addEventListener('touchend',   () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } });
  el.addEventListener('touchcancel',() => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } });
  el.addEventListener('touchmove',  () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } }, { passive: true });
  // Desktop: long mousedown
  el.addEventListener('mousedown', () => {
    holdTimer = setTimeout(() => { holdTimer = null; openDataMenu(); }, 800);
  });
  el.addEventListener('mouseup',   () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } });
  el.addEventListener('mouseleave',() => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } });
}

// ─── Area delete popup ────────────────────────────────────────────────────────

function showAreaDeletePopup(areaId, areaName, anchorCard) {
  // Remove any existing popup
  const existing = document.getElementById('area-delete-popup');
  if (existing) existing.remove();

  const taskCount = state.tasks.filter(t => t.areaId === areaId).length;

  const popup = document.createElement('div');
  popup.id = 'area-delete-popup';
  popup.className = 'area-delete-popup';
  popup.innerHTML = `
    <div class="area-delete-popup-inner">
      <span class="area-delete-label">${taskCount > 0
        ? `Delete "${escapeHtml(areaName)}"? (${taskCount} task${taskCount > 1 ? 's' : ''} will be deleted)`
        : `Delete "${escapeHtml(areaName)}"?`
      }</span>
      <button class="area-delete-confirm">Delete</button>
      <button class="area-delete-cancel">Cancel</button>
    </div>
  `;

  popup.querySelector('.area-delete-confirm').addEventListener('click', (e) => {
    e.stopPropagation();
    popup.remove();
    deleteArea(areaId);
  });
  popup.querySelector('.area-delete-cancel').addEventListener('click', (e) => {
    e.stopPropagation();
    popup.remove();
  });

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
        setMobileView(area.id);
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
  if ((isArea || isAll || mobileShowCompleted) && isMobile()) {
    backBtn.classList.remove('hidden');
  } else {
    backBtn.classList.add('hidden');
  }
}

function updateCompletedToggle() {
  // No-op: completed toggle removed, now using inline header link
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

  // Weekly review modal
  document.getElementById('weekly-review-keep').addEventListener('click', closeWeeklyReviewModal);
  document.getElementById('weekly-review-overlay').addEventListener('click', closeWeeklyReviewModal);
  document.getElementById('weekly-review-remove').addEventListener('click', () => {
    const ids = pendingWeeklyStats ? pendingWeeklyStats.incompleteThisWeekIds : [];
    closeWeeklyReviewModal();
    removeIncompleteFromWeek(ids);
  });

  if (pendingWeeklyStats) {
    showWeeklyReviewModal(pendingWeeklyStats);
  }

  // Static sidebar nav
  document.getElementById('nav-this-week').addEventListener('click', () => setView('this-week'));
  document.getElementById('nav-all').addEventListener('click',       () => setView('all'));
  document.getElementById('nav-completed').addEventListener('click', () => setView('completed'));

  // Add new / area
  document.getElementById('add-new-btn').addEventListener('click', () => openNewModal());
  document.getElementById('add-area-btn').addEventListener('click', openAddArea);

  // New modal (unified task + goal)
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
  document.getElementById('mobile-nav-add').addEventListener('click', () => openNewModal());

  // Mobile: + action menu
  document.getElementById('mobile-add-new').addEventListener('click', () => {
    closeAddActionMenu();
    openNewModal();
  });
  document.getElementById('add-action-overlay').addEventListener('click', closeAddActionMenu);

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

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }

});
