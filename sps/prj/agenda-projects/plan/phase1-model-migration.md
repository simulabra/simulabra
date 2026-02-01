# Phase 1: Project Model & Migration

Add a Project model to the data layer and extend Task, Log, and Reminder with a nullable projectId foreign key.

## Dependencies
None. This is the foundation phase.

## Files to modify

- `apps/agenda/src/models.js` — Add Project class, add projectId DBVar to Task, Log, Reminder
- `apps/agenda/src/sqlite.js` — Add migration 006_create_projects, register in AgendaMigrations.all()

## Changes

### models.js: New Project class

Add a new `$.Class.new` block after the existing PromptConfig class (before the closing `.module()`). The Project class mixes in `$sqlite.SQLitePersisted` and defines these DBVar slots:

- `title` (string, searchable, mutable) — human-readable project name (renamed from `name` to avoid Simulabra built-in slot collision)
- `slug` (string, indexed, mutable) — unique URL-safe handle (e.g. "taxes-2026")
- `archived` (boolean, indexed, mutable, default: false)
  - toSQL: `this ? 'true' : 'false'`
  - fromSQL: `this === 'true'`
- `context` (string, mutable) — freeform markdown context for Geist and humans

Add a `description()` Method that returns `[slug] name` (with archived indicator if archived).

### models.js: Add projectId to Task, Log, and Reminder

Add a new DBVar to each of the three existing classes:

```javascript
$db.DBVar.new({
  name: 'projectId',
  doc: 'optional project reference',
  indexed: true,
  mutable: true,
}),
```

No toSQL/fromSQL needed — projectId is stored as plain TEXT (the sid of a Project) and null means "Inbox/Unassigned". Place it after the `tags` DBVar in Task and Log, and after the `sent` DBVar in Reminder.

### sqlite.js: Migration 006_create_projects

Add `migration006` after migration005. Structure:

**1) Create agenda_Project table:**
- sid TEXT PRIMARY KEY
- name TEXT
- slug TEXT
- archived TEXT
- context TEXT
- createdAt TEXT
- updatedAt TEXT

**2) Indexes:**
- `idx_agenda_Project_archived` on (archived)
- `idx_agenda_Project_slug` UNIQUE on (slug)

**3) FTS for Project** (name searchable, following migration 003 pattern):
- `agenda_Project_fts` using fts5(sid, name)
- Insert/delete/update triggers (ai, ad, au) matching the existing pattern

**4) Add projectId column to existing tables:**
- `ALTER TABLE agenda_Task ADD COLUMN projectId TEXT`
- `ALTER TABLE agenda_Log ADD COLUMN projectId TEXT`
- `ALTER TABLE agenda_Reminder ADD COLUMN projectId TEXT`

**5) Index on projectId for each table:**
- `idx_agenda_Task_projectId` on agenda_Task(projectId)
- `idx_agenda_Log_projectId` on agenda_Log(projectId)
- `idx_agenda_Reminder_projectId` on agenda_Reminder(projectId)

**down():** Drop triggers, FTS table, indexes, the Project table. (SQLite can't DROP COLUMN on older versions; the projectId columns remain but are ignored.)

Update `AgendaMigrations.all()` to include migration006.

## Testing

- **ProjectCreation**: Create a Project with name, slug, context. Assert defaults (archived=false). Assert description() output.
- **ProjectPersistence**: Save to DB, findById, assert all fields round-trip (name, slug, archived, context, createdAt, updatedAt).
- **ProjectSlugUniqueness**: Save two projects with the same slug. Assert the second save throws (UNIQUE constraint violation).
- **TaskWithProjectId**: Create task with projectId set. Save, reload, assert projectId preserved.
- **TaskWithNullProjectId**: Create task without projectId. Assert projectId is null after save+reload.
- **LogWithProjectId / ReminderWithProjectId**: Same pattern.

Run: `bun run test`

## Acceptance criteria
- Migration 006 applies cleanly on both fresh DB and existing DB with data
- Project model saves, loads, and round-trips all fields
- Slug uniqueness is enforced at the database level
- Task, Log, and Reminder accept and persist optional projectId
- All existing tests continue to pass (projectId defaults to null)

## Review

**Verdict: APPROVED** — Phase 1 is complete and ready to be marked done.

**Code quality:** Clean and idiomatic. The Project class follows the same DBVar/SQLitePersisted pattern as the five existing model classes. No unnecessary abstractions, no accidental complexity.

**Correctness:**
- All 57 model tests pass (8 new + 49 existing unchanged)
- All 13 sqlite tests pass (migration count/rollback version updated)
- Migration 006 applies and rolls back cleanly
- FTS triggers follow the exact pattern from migration003
- UNIQUE index on slug enforces constraint at DB level

**Scope deviation:** Plan specified `name` as Project's human-readable field; renamed to `title` because `name` is a reserved Simulabra built-in slot. This was the correct decision — consistent with Task.title. The deviation was documented in WORKLOG.md and CLAUDE.md was updated to prevent recurrence.

**Style notes:**
- Slot placement in Task/Log/Reminder matches plan (after tags/sent respectively)
- Doc strings are present on all new slots and methods
- Test cases use unique slugs to avoid inter-test collision
- down() correctly avoids DROP COLUMN for SQLite compatibility

**No issues to flag.**
