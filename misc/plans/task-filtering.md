# Task Filtering Plan

## Problem Statement

The tasks view currently shows all tasks in a flat list sorted by priority. There is no way to focus on active work (high-priority tasks) versus the backlog, and completed tasks are mixed in without useful organization. The goal is to provide a focused default view showing p1-p3 tasks with a small tail of recently completed tasks, plus alternate views for the backlog and completion history.

## Current State

### TodosView (apps/agenda/src/ui/app.js:259-288)

Shows all tasks from `app.tasks()` in a single list, sorted by priority. No filtering, no separation of done/not-done, no sub-navigation.

### Data Flow

```
AgendaApp.refreshData()
  -> api.listTasks({})          # fetches ALL tasks, no filter
     -> POST /api/v1/tasks/list
        -> DatabaseService.listTasks(filter)
           -> Task.findAll() + in-memory filter/sort
  -> app.tasks(result)          # stores flat array in Signal
```

### Task Shape (from jsonify)

```
{ id, title, done, priority, dueDate, completedAt, tags }
```

Priority: 1=highest, 5=lowest. `completedAt` is an ISO timestamp set when `task.complete()` is called.

### Backend Filter Support (DatabaseService.listTasks)

Currently supports exact match filters:
- `done` (boolean) - filter by completion status
- `priority` (number) - exact priority match
- `tag` (string) - tasks containing a specific tag

Does NOT support: priority ranges, sorting by completedAt, limit/offset.

## Design

### Concept: TaskFilter

The filtering should happen entirely on the client side. The app already fetches all tasks into `app.tasks()`. The TodosView will gain a `taskFilter` Signal to switch between three named views, each of which defines what subset of tasks to display and how to present them.

### Three Filter Modes

| Mode | Label | Content |
|------|-------|---------|
| `"active"` | Active | Incomplete tasks with priority <= 3, plus last 3 completed tasks |
| `"backlog"` | Backlog | Incomplete tasks with priority > 3 (i.e. p4, p5) |
| `"completed"` | Done | All completed tasks, sorted by completedAt descending |

`"active"` is the default.

### Component Map

```
TodosView
  taskFilter: Signal("active")       # current filter mode
  filterTabs()                       # renders the three tab buttons
  filteredTasks()                    # computes the task list for current mode
  render()                           # header with tabs + filtered task list

TaskItem (unchanged)
  task, handleComplete, render
```

### TodosView Responsibilities

**taskFilter** - a Signal holding one of `"active"`, `"backlog"`, `"completed"`. Default: `"active"`.

**filteredTasks** - a method that reads `app.tasks()` and `taskFilter()` and returns the appropriate subset:

- **active**: Filter to incomplete tasks with priority <= 3, sorted by priority ascending. Then append the 3 most recently completed tasks (sorted by completedAt descending, take 3), which appear at the bottom of the list as a "recently done" group.
- **backlog**: Filter to incomplete tasks with priority > 3, sorted by priority ascending.
- **completed**: Filter to all completed tasks, sorted by completedAt descending.

**render** - The view header gains a row of filter tabs (three small buttons/pills). The active tab is visually highlighted. The task count in the header reflects the current filtered set. The task list renders the output of `filteredTasks()`.

For the "active" mode, recently completed tasks should be visually separated -- a thin divider or subtle section label ("recently done") between the active tasks and the completed tail.

### Data Structures

No new models or API changes required. All filtering is done client-side from the existing `app.tasks()` Signal, which already contains all tasks with `done`, `priority`, and `completedAt` fields.

### Backend Changes

**DatabaseService.listTasks** - Add `maxPriority` filter support so the API can filter by priority range (`priority <= maxPriority`). This is not strictly needed for the initial client-side implementation but rounds out the API for future use (e.g. the geist service or CLI might want to query only active tasks).

### Styling

New CSS in `apps/agenda/src/style.css`:

- `.filter-tabs` - horizontal row of filter pill buttons inside the view header
- `.filter-tab` / `.filter-tab.active` - individual tab styling (subtle, compact)
- `.task-section-divider` - thin separator between active and recently-completed tasks
- `.task-section-label` - small muted label for "recently done"

### Files to Change

| File | Change |
|------|--------|
| `apps/agenda/src/ui/app.js` | Add `taskFilter` Signal and `filteredTasks` method to TodosView; update `render` to include filter tabs and use `filteredTasks` |
| `apps/agenda/src/style.css` | Add filter tab and section divider styles |
| `apps/agenda/src/services/database.js` | Add `maxPriority` filter to `listTasks` |

## Test Plan

- Unit test: `filteredTasks` returns correct subsets for each mode given a known task list
- Unit test: active mode includes exactly 3 most recent completed tasks
- Unit test: backlog mode excludes p1-p3 tasks
- Unit test: completed mode sorts by completedAt descending
- Manual: verify tab switching updates the displayed list reactively
- Manual: verify completing a task from active view moves it to the recently-done section

## Estimate

Small feature, ~45 minutes. The main work is in TodosView's render method and the filteredTasks logic. No new classes, no API protocol changes, no architectural shifts.
