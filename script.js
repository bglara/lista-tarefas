"use strict";

/**
 * A vanilla JavaScript to-do app with:
 * - categories
 * - due dates
 * - status/date/category filters
 * - fuzzy text search
 * - localStorage persistence
 */

const STORAGE_KEY = "task-list-app.tasks";
const THEME_STORAGE_KEY = "task-list-app.theme";
const DEFAULT_CATEGORY = "General";

/** @type {HTMLInputElement} */
const taskInput = document.querySelector("#task-input");
/** @type {HTMLInputElement} */
const taskCategoryInput = document.querySelector("#task-category-input");
/** @type {HTMLInputElement} */
const taskDueDateInput = document.querySelector("#task-due-date-input");
/** @type {HTMLButtonElement} */
const addTaskButton = document.querySelector("#add-task-button");
/** @type {HTMLButtonElement} */
const themeToggleButton = document.querySelector("#theme-toggle-button");
/** @type {NodeListOf<HTMLButtonElement>} */
const statusFilterButtons = document.querySelectorAll(".filter-button");
/** @type {HTMLInputElement} */
const searchInput = document.querySelector("#search-input");
/** @type {HTMLSelectElement} */
const categoryFilterSelect = document.querySelector("#category-filter-select");
/** @type {HTMLInputElement} */
const dateFromInput = document.querySelector("#date-from-input");
/** @type {HTMLInputElement} */
const dateToInput = document.querySelector("#date-to-input");
/** @type {HTMLButtonElement} */
const clearFiltersButton = document.querySelector("#clear-filters-button");
/** @type {HTMLUListElement} */
const taskList = document.querySelector("#task-list");
/** @type {HTMLParagraphElement} */
const emptyState = document.querySelector("#empty-state");
/** @type {HTMLSpanElement} */
const totalCountElement = document.querySelector("#total-count");
/** @type {HTMLSpanElement} */
const pendingCountElement = document.querySelector("#pending-count");
/** @type {HTMLSpanElement} */
const completedCountElement = document.querySelector("#completed-count");

/**
 * In-memory task state.
 * @type {{ id: string; text: string; completed: boolean; category: string; dueDate: string }[]}
 */
let tasks = loadTasks();
const filterState = {
  status: "all",
  query: "",
  category: "all",
  dateFrom: "",
  dateTo: "",
};
let searchDebounceTimeoutId = null;

/**
 * Returns the preferred theme from localStorage.
 * Falls back to the user's OS preference.
 * @returns {"light" | "dark"}
 */
function getInitialTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

/**
 * Updates UI and persistence for a given theme.
 * @param {"light" | "dark"} theme
 */
function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_STORAGE_KEY, theme);

  const nextTheme = theme === "dark" ? "light" : "dark";
  themeToggleButton.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
  themeToggleButton.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
}

/**
 * Toggles between dark and light theme.
 */
function toggleTheme() {
  const currentTheme = document.body.getAttribute("data-theme") === "dark" ? "dark" : "light";
  applyTheme(currentTheme === "dark" ? "light" : "dark");
}

/**
 * Reads tasks from localStorage.
 * Returns an empty array when no valid data exists.
 * Also normalizes legacy items that do not have category/dueDate.
 * @returns {{ id: string; text: string; completed: boolean; category: string; dueDate: string }[]}
 */
function loadTasks() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return [];
  }

  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (task) =>
          typeof task?.id === "string" &&
          typeof task?.text === "string" &&
          typeof task?.completed === "boolean"
      )
      .map((task) => ({
        id: task.id,
        text: task.text.trim(),
        completed: task.completed,
        category: normalizeCategory(task.category),
        dueDate: normalizeDate(task.dueDate),
      }));
  } catch (error) {
    console.error("Could not parse tasks from localStorage:", error);
    return [];
  }
}

/**
 * Returns a safe category string.
 * @param {unknown} value
 * @returns {string}
 */
function normalizeCategory(value) {
  if (typeof value !== "string") {
    return DEFAULT_CATEGORY;
  }
  const normalized = value.trim();
  return normalized || DEFAULT_CATEGORY;
}

/**
 * Ensures due date is a valid YYYY-MM-DD string.
 * @param {unknown} value
 * @returns {string}
 */
function normalizeDate(value) {
  if (typeof value !== "string") {
    return "";
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

/**
 * Saves current tasks to localStorage.
 */
function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

/**
 * Generates a unique id for new tasks.
 * @returns {string}
 */
function createTaskId() {
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Adds a new task to the state.
 */
function addTask() {
  const text = taskInput.value.trim();
  const category = normalizeCategory(taskCategoryInput.value);
  const dueDate = normalizeDate(taskDueDateInput.value);
  if (!text) {
    taskInput.focus();
    return;
  }

  tasks.push({
    id: createTaskId(),
    text,
    completed: false,
    category,
    dueDate,
  });

  taskInput.value = "";
  taskCategoryInput.value = "";
  taskDueDateInput.value = "";
  saveTasks();
  resetAllFilters();
  taskInput.focus();
}

/**
 * Toggles completed state for a task id.
 * @param {string} taskId
 */
function toggleTask(taskId) {
  tasks = tasks.map((task) =>
    task.id === taskId ? { ...task, completed: !task.completed } : task
  );
  saveTasks();
  render();
}

/**
 * Removes a task by id.
 * @param {string} taskId
 */
function removeTask(taskId) {
  tasks = tasks.filter((task) => task.id !== taskId);
  saveTasks();
  render();
}

/**
 * Changes status filter and updates button styles.
 * @param {"all" | "pending" | "completed"} nextFilter
 */
function setStatusFilter(nextFilter) {
  filterState.status = nextFilter;
  statusFilterButtons.forEach((button) => {
    const isActive = button.dataset.filter === filterState.status;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  render();
}

/**
 * Returns normalized text for robust search comparisons.
 * @param {string} value
 * @returns {string}
 */
function normalizeSearchText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Computes Levenshtein distance between two strings.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function levenshteinDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j < cols; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

/**
 * Returns max typo tolerance based on query length.
 * @param {number} queryLength
 * @returns {number}
 */
function getFuzzyThreshold(queryLength) {
  if (queryLength <= 3) {
    return 0;
  }
  if (queryLength <= 6) {
    return 1;
  }
  return 2;
}

/**
 * Checks if task text matches query with accent/case normalization and fuzzy matching.
 * @param {string} taskText
 * @param {string} rawQuery
 * @returns {boolean}
 */
function matchesSearch(taskText, rawQuery) {
  const query = normalizeSearchText(rawQuery);
  if (!query) {
    return true;
  }

  const normalizedTask = normalizeSearchText(taskText);
  if (normalizedTask.includes(query)) {
    return true;
  }

  const queryTokens = query.split(/\s+/).filter(Boolean);
  const taskTokens = normalizedTask.split(/\s+/).filter(Boolean);

  return queryTokens.every((queryToken) => {
    const threshold = getFuzzyThreshold(queryToken.length);
    return taskTokens.some((taskToken) => {
      if (taskToken.includes(queryToken)) {
        return true;
      }
      const distance = levenshteinDistance(queryToken, taskToken);
      return distance <= threshold;
    });
  });
}

/**
 * Returns all visible tasks after applying the complete filter pipeline.
 * @returns {{ id: string; text: string; completed: boolean; category: string; dueDate: string }[]}
 */
function getVisibleTasks() {
  return tasks.filter((task) => {
    if (filterState.status === "pending" && task.completed) {
      return false;
    }
    if (filterState.status === "completed" && !task.completed) {
      return false;
    }

    if (filterState.category !== "all" && task.category !== filterState.category) {
      return false;
    }

    if (filterState.dateFrom && (!task.dueDate || task.dueDate < filterState.dateFrom)) {
      return false;
    }
    if (filterState.dateTo && (!task.dueDate || task.dueDate > filterState.dateTo)) {
      return false;
    }

    return matchesSearch(task.text, filterState.query);
  });
}

/**
 * Populates category select with existing categories from tasks.
 */
function syncCategoryFilterOptions() {
  const previous = categoryFilterSelect.value || "all";
  const categories = Array.from(new Set(tasks.map((task) => task.category))).sort((a, b) =>
    a.localeCompare(b)
  );

  categoryFilterSelect.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All categories";
  categoryFilterSelect.appendChild(allOption);

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilterSelect.appendChild(option);
  });

  const shouldKeepPrevious =
    previous === "all" || categories.some((category) => category === previous);
  categoryFilterSelect.value = shouldKeepPrevious ? previous : "all";
  filterState.category = categoryFilterSelect.value;
}

/**
 * Clears all advanced filters and resets status to total.
 */
function resetAllFilters() {
  filterState.query = "";
  filterState.category = "all";
  filterState.dateFrom = "";
  filterState.dateTo = "";

  searchInput.value = "";
  dateFromInput.value = "";
  dateToInput.value = "";
  syncCategoryFilterOptions();
  setStatusFilter("all");
}

/**
 * Updates all counter labels.
 */
function updateCounters() {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed).length;
  const pending = total - completed;

  totalCountElement.textContent = `Total: ${total}`;
  pendingCountElement.textContent = `Pending: ${pending}`;
  completedCountElement.textContent = `Completed: ${completed}`;
}

/**
 * Creates and returns a single task list item element.
 * @param {{ id: string; text: string; completed: boolean; category: string; dueDate: string }} task
 * @returns {HTMLLIElement}
 */
function buildTaskElement(task) {
  const item = document.createElement("li");
  item.className = "task-item";
  if (task.completed) {
    item.classList.add("task-item--completed");
  }

  const checkbox = document.createElement("input");
  checkbox.className = "task-item__checkbox";
  checkbox.type = "checkbox";
  checkbox.checked = task.completed;
  checkbox.setAttribute("aria-label", `Mark task "${task.text}" as completed`);
  checkbox.addEventListener("change", () => {
    toggleTask(task.id);
  });

  const content = document.createElement("div");
  const text = document.createElement("p");
  text.className = "task-item__text";
  text.textContent = task.text;

  const details = document.createElement("p");
  details.className = "task-item__details";
  const dueDateText = task.dueDate ? task.dueDate : "No due date";
  const categoryTag = document.createElement("span");
  categoryTag.className = "task-item__category";
  categoryTag.textContent = task.category;
  details.append(categoryTag, ` | Due: ${dueDateText}`);
  content.append(text, details);

  const removeButton = document.createElement("button");
  removeButton.className = "task-item__remove";
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.setAttribute("aria-label", `Remove task "${task.text}"`);
  removeButton.addEventListener("click", () => {
    removeTask(task.id);
  });

  item.append(checkbox, content, removeButton);
  return item;
}

/**
 * Renders the current state to the DOM.
 */
function render() {
  syncCategoryFilterOptions();
  const visibleTasks = getVisibleTasks();
  taskList.innerHTML = "";
  visibleTasks.forEach((task) => {
    taskList.appendChild(buildTaskElement(task));
  });

  emptyState.textContent = visibleTasks.length
    ? "No tasks yet. Add your first one!"
    : "No tasks match the current filters.";
  emptyState.hidden = visibleTasks.length > 0;
  updateCounters();
}

/**
 * Registers UI events and performs the initial render.
 */
function init() {
  addTaskButton.addEventListener("click", addTask);
  themeToggleButton.addEventListener("click", toggleTheme);
  statusFilterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextFilter = button.dataset.filter;
      if (nextFilter === "all" || nextFilter === "pending" || nextFilter === "completed") {
        setStatusFilter(nextFilter);
      }
    });
  });
  categoryFilterSelect.addEventListener("change", () => {
    filterState.category = categoryFilterSelect.value;
    render();
  });
  dateFromInput.addEventListener("change", () => {
    filterState.dateFrom = dateFromInput.value;
    render();
  });
  dateToInput.addEventListener("change", () => {
    filterState.dateTo = dateToInput.value;
    render();
  });
  searchInput.addEventListener("input", () => {
    if (searchDebounceTimeoutId) {
      window.clearTimeout(searchDebounceTimeoutId);
    }
    searchDebounceTimeoutId = window.setTimeout(() => {
      filterState.query = searchInput.value;
      render();
    }, 160);
  });
  clearFiltersButton.addEventListener("click", resetAllFilters);

  taskInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      addTask();
    }
  });

  applyTheme(getInitialTheme());
  resetAllFilters();
  render();
}

init();
