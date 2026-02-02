---
title: agenda-projects
description: Add projects as first-class entities to the Agenda app, with project-scoped tasks/logs/reminders, context-driven Geist integration, and prompting system support.
tags:
    - agenda
    - feature
---

# Agenda Projects

## Project overview
Evolve the Agenda productivity app by adding Projects as a grouping and context layer. Tasks, logs, and reminders can belong to a project. Each project carries custom context that Geist (LLM) uses to tailor responses. The UI provides project-filtered views. Rather than a static UI-driven project selection, Geist determines relevant projects from message context in its agentic flow.

Use cases driving this: organizing ancient coin cleaning/identification work and house projects, each with their own context and task streams.

## Status
IN PROGRESS — Phase 4 done, Phase 5 next.

## Phases
- [x] Phase 1: Project Model & Migration
- [x] Phase 2: DatabaseService Project CRUD
- [x] Phase 3: HTTP API Endpoints
- [x] Phase 4: Project Tools for Geist
- [ ] Phase 5: Context-Driven Project Resolution
- [ ] Phase 6: UI Project Selector & Filtering
- [ ] Phase 7: UI Project Context Panel
- [ ] Phase 8: Prompting System Integration

## Key decisions
- Virtual Inbox: projectId=null means Inbox/Unassigned
- All item types (Task, Log, Reminder) get projectId
- Hard unique slug constraint on Project
- Geist resolves projects from message context, not static UI state
- Prompting system includes project context

## History
### 2.1.2026
- Created project from existing design sketch in docs/agenda-projects.md
- Gathered requirements: virtual inbox, all item types, hard slug uniqueness
- User wants context-driven Geist (determines projects from message), not static activeProjectId
- User wants prompting system included in v1
- Wrote 8-phase plan
- **Phase 1 complete**: Project model (title/slug/archived/context), migration 006, projectId on Task/Log/Reminder. Note: plan used `name` for Project's human-readable field but renamed to `title` to avoid Simulabra `name` slot collision.
- **Phase 1 review**: Approved. Code is clean, idiomatic, well-tested. 57 model + 13 sqlite tests pass. No issues found.
- **Phase 2 complete**: Project CRUD RPCs (createProject, getProject, getProjectBySlug, listProjects, updateProject), projectId on create/list/update for Task/Log/Reminder, new updateLog and updateReminder RPCs. 49 database service tests pass.
- **Phase 2 review**: Approved. Added doc strings to all 7 new RPCs. Code is correct, idiomatic, and consistent with existing patterns. Three-way projectId filtering applied uniformly. No issues found.
- **Phase 3 complete**: 5 new HTTP API endpoints in run.js — project CRUD (list/create/get/update) and tasks/update. Thin adapter layer with 400 validation. Existing list endpoints automatically support projectId filtering. All tests pass.
- **Phase 3 review**: Approved. All endpoints follow the established apiHandler pattern. Validation is consistent (HttpError with MISSING_FIELD code). Correctly uses `title` over plan's `name`. No issues found.
- **Phase 4 complete**: 4 new Geist tools (create_project, list_projects, update_project, move_to_project). 6 existing tools extended with optional projectId. Registry now has 13 tools. move_to_project supports both projectId and projectSlug lookup. Fixed pre-existing mock bug in tools test. 15 agenda tools tests pass.
- **Phase 4 review**: Approved. Fixed ListLogsTool.execute which was discarding projectId despite declaring it in schema. Code is correct, idiomatic, and consistent. MoveToProjectTool dispatch logic is clean. All 13 tool definitions pass Anthropic format validation. No other issues found.
