# Agenda Scheduler - Plan

## Goal

Design a flexible scheduler for agenda services that runs jobs at specific times (e.g., 8 AM and 6 PM for prompt generation) rather than just intervals. The scheduler should be extensible for other scheduled tasks like reminder texts, daily digests, and other time-based operations.

## Current State

GeistService currently uses interval-based polling:
- `pollInterval` (1 hour) controls how often to check
- `shouldPoll()` checks if `promptFrequencyHours` (8 hours) has elapsed since `lastGenerationAt`
- This approach runs prompts at unpredictable times based on when the service started

Problems:
1. Prompt generation happens at arbitrary times (e.g., 3:17 AM)
2. No way to specify "run at 8 AM and 6 PM"
3. No duplicate prevention for prompts on the same item
4. Interval-based approach wastes CPU cycles checking when nothing needs to happen

## Design

### Core Abstraction: ScheduledJob

A lightweight job abstraction that encapsulates:
- When to run (schedule specification)
- What to run (action function)
- How to handle failures (retry policy)

```
ScheduledJob
├── name             string       unique identifier
├── schedule         Schedule     when to run
├── action           async fn     what to do
├── lastRunAt        Date         for persistence/recovery
├── enabled          boolean      can be disabled
└── run()            executes if due
```

### Schedule Types

Support two scheduling modes to cover all use cases:

**TimeOfDaySchedule** - Run at specific times
```
TimeOfDaySchedule
├── times            string[]     ["08:00", "18:00"]
├── timezone         string       e.g., "America/Los_Angeles" or "local"
└── isDue(lastRun, now)
```

**IntervalSchedule** - Run every N milliseconds (existing behavior, kept for compatibility)
```
IntervalSchedule
├── intervalMs       number
└── isDue(lastRun, now)
```

### Scheduler Service

Centralizes job management and execution:

```
Scheduler
├── jobs             Map<string, ScheduledJob>
├── tickIntervalMs   number       how often to check (default: 60000)
├── running          boolean
├── timer            reference
│
├── register(job)    add a job
├── unregister(name) remove a job
├── start()          begin the tick loop
├── stop()           halt the tick loop
├── tick()           check all jobs, run due ones
└── runJob(job)      execute single job with error handling
```

### Where the Scheduler Lives

**Option A**: Embed in GeistService (simplest)
- Add Scheduler as a slot on GeistService
- Register prompt generation as a job on init
- Pro: No new service, keeps things simple
- Con: Less reusable

**Option B**: Standalone mixin (recommended)
- Create ScheduledServiceMixin that any service can compose
- GeistService composes the mixin
- Pro: Reusable by ReminderService, future services
- Con: Slightly more abstraction

Recommend Option B for future extensibility.

### Timezone Handling

For a single-user app, keep timezone simple:
- Store a `AGENDA_TIMEZONE` env var (defaults to system local)
- TimeOfDaySchedule converts "08:00" to next UTC occurrence using the configured timezone
- Use Intl.DateTimeFormat for timezone conversion (no dependencies)

```javascript
// Convert local time to next UTC occurrence
function nextOccurrence(timeStr, timezone) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const now = new Date();

  // Get current time in target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric', minute: 'numeric', hour12: false
  });

  // Calculate next occurrence...
}
```

### Duplicate Prompt Prevention

Add to GeistService.generatePrompts():

1. Before creating a prompt, check if a pending prompt exists for the same itemType/itemId
2. Add a DatabaseService method: `hasPendingPromptForItem({ itemType, itemId })`
3. Skip creation if duplicate exists

```
DatabaseService.hasPendingPromptForItem({ itemType, itemId })
├── Query: SELECT 1 FROM prompts WHERE itemType=? AND itemId=? AND status='pending' LIMIT 1
└── Returns: boolean
```

This is simpler than time-based deduplication (like "no prompt for same item within N days") and avoids showing the same prompt repeatedly.

## Architecture

```
src/time.js (extended)
├── TimePolicy (existing)
├── RecurrenceRule (existing)
├── Schedule (new base class)
├── TimeOfDaySchedule (new)
├── IntervalSchedule (new)
└── ScheduledJob (new)

GeistService (extended)
├── scheduler           Scheduler instance
├── init                registers prompt generation job
├── connectToDatabase   scheduler starts after DB connection
└── generatePrompts     now checks for duplicates

DatabaseService (extended)
└── hasPendingPromptForItem({ itemType, itemId }) → boolean
```

## Implementation Phases

### Phase 1: Schedule Classes
- Add Schedule base class with `isDue(lastRun, now)` interface
- Add TimeOfDaySchedule with times[], timezone, and isDue() logic
- Add IntervalSchedule for backward compatibility
- Add ScheduledJob class

### Phase 2: Scheduler
- Create Scheduler class with job registry
- Implement tick loop that checks all jobs
- Add error handling and logging

### Phase 3: Integrate with GeistService
- Add scheduler slot to GeistService
- Register prompt generation as TimeOfDaySchedule job
- Configure default times via env vars (AGENDA_PROMPT_TIMES="08:00,18:00")
- Remove old polling implementation

### Phase 4: Duplicate Prevention
- Add hasPendingPromptForItem to DatabaseService
- Modify generatePrompts to skip items with pending prompts

### Phase 5: Testing
- Unit tests for TimeOfDaySchedule.isDue()
- Unit tests for Scheduler job execution
- Integration test for scheduled prompt generation
- Test duplicate prevention

## Configuration

Environment variables:
```
AGENDA_TIMEZONE=America/Los_Angeles   # or "local" for system timezone
AGENDA_PROMPT_TIMES=08:00,18:00       # comma-separated times
```

Default behavior:
- Timezone defaults to system local
- Times default to 8:00 and 18:00

## Example Usage

```javascript
// In GeistService.init()
const scheduler = _.Scheduler.new();

scheduler.register(_.ScheduledJob.new({
  name: 'generatePrompts',
  schedule: _.TimeOfDaySchedule.new({
    times: (process.env.AGENDA_PROMPT_TIMES || '08:00,18:00').split(','),
    timezone: process.env.AGENDA_TIMEZONE || 'local',
  }),
  action: async () => {
    await this.generatePrompts();
  },
}));

// After DB connection
scheduler.start();
```

## Future Extensions

The scheduler design supports:
- **Daily digest emails**: Register a job for 7:00 AM
- **Reminder batching**: Collect due reminders and send in batches
- **Cleanup jobs**: Archive old prompts, compact logs
- **SMS notifications**: Time-limited windows for texts

Each becomes a simple job registration.

## Open Questions

1. **Persistence**: Should we store job lastRunAt in the database for crash recovery?
   - For single-user app, probably not needed - just run on startup
   - Could add later if needed

2. **Missed runs**: If the service was down during a scheduled time, run immediately on startup?
   - Recommend yes for prompt generation
   - Add `runOnMissed: boolean` flag to ScheduledJob

## Estimate

| Phase | Description | Estimate |
|-------|-------------|----------|
| 1 | Schedule classes | 1 hour |
| 2 | Scheduler | 1 hour |
| 3 | GeistService integration | 1 hour |
| 4 | Duplicate prevention | 30 min |
| 5 | Testing | 1-2 hours |

**Total: 4-6 hours**

## Summary

This design:
- Replaces interval polling with time-of-day scheduling
- Keeps it simple (no cron syntax, just time strings)
- Handles timezone properly
- Prevents duplicate prompts
- Is extensible for future scheduled tasks
- Stays true to Simulabra idioms (classes with slots, mixins)
