# Task List App (Vanilla JS)

A lightweight and responsive to-do list built with plain HTML, CSS, and JavaScript.
No frameworks, no build tools, and no external dependencies.

## Core Features

- Add tasks using:
  - The **Add Task** button
  - The **Enter** key in the main task input
- Mark tasks as completed with a checkbox
- Remove tasks with a remove button
- Toggle between **Light** and **Dark** mode
- Live counters:
  - Total tasks
  - Pending tasks
  - Completed tasks

## Categories and Due Dates

- Each task supports:
  - `category` (text)
  - `dueDate` (optional, `YYYY-MM-DD`)
- Category defaults to `"General"` when missing or empty
- Due date is optional and safely normalized

## Filtering and Search

### Status Filters

- **Total**: shows all tasks
- **Pending**: shows only not completed tasks
- **Completed**: shows only completed tasks

### Advanced Filters

- Fuzzy text search:
  - case-insensitive
  - accent-insensitive (`José`, `jose`, `JOSE`)
  - typo-tolerant using Levenshtein distance
- Category filter
- Due date range filter (`From` / `To`)
- **Clear Filters** button to reset all filters

### Filter Behavior

- After adding a new task, filters are reset to show all tasks so the new item is immediately visible.

## Persistence

- Tasks are stored in `localStorage` key: `task-list-app.tasks`
- Theme preference is stored in: `task-list-app.theme`
- Legacy tasks are normalized on load for backward compatibility:
  - `category: "General"`
  - `dueDate: ""`

## Project Structure

- `index.html` - Semantic structure and UI elements
- `styles.css` - Theme-aware and responsive styling
- `script.js` - State, rendering, filtering, and persistence logic

## How to Run Locally

### Quick Option

1. Open the project folder.
2. Open `index.html` in your browser.

### Recommended (Local Server)

1. Run a static server from the project folder:
   - Python: `python -m http.server 8000`
   - Node.js: `npx serve .`
2. Open `http://localhost:8000`.

## Browser Support

Works in modern browsers that support:

- ES6+ JavaScript features
- `localStorage`
- `String.prototype.normalize`
- `matchMedia`

Tested conceptually for current versions of Chrome, Edge, Firefox, and Safari.
