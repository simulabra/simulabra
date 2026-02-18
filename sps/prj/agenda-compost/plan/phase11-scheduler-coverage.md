# Phase 11: Scheduler and Time System Coverage

## Goal
Cover `Scheduler`, `ScheduledJob`, and `GeistService.initScheduler/startScheduler/stopScheduler` methods. Currently only Scheduler start/stop has a basic state test.

## Tests to Add

### ScheduledJob (in `apps/agenda/tests/time.js`)

Source: `ScheduledJob` class in `src/time.js`. Has `run()`, `calculateNextRun(timezone)`, `enabled`, `lastRunAt`, `nextRunAt`.

| Test Name | Scenario |
|---|---|
| `ScheduledJobRun` | Create job with mock action, call `run()`. Assert action was called and `lastRunAt()` is set. |
| `ScheduledJobRunDisabled` | Create job with `enabled: false`, call `run()`. Assert action was NOT called. |
| `ScheduledJobCalculateNextRun` | Create job with a `TimeOfDaySchedule`, call `calculateNextRun('UTC')`. Assert `nextRunAt()` is a future Date. |

### Scheduler register/unregister (in `apps/agenda/tests/time.js`)

Source: `Scheduler` class in `src/time.js`. Has `register(job)`, `unregister(jobName)`, `scheduleJob(job)`, `start()`, `stop()`.

| Test Name | Scenario |
|---|---|
| `SchedulerRegister` | Create scheduler, register a job. Assert `jobs()` contains the job. |
| `SchedulerUnregister` | Register a job, unregister it. Assert `jobs()` no longer has it. |
| `SchedulerStartSchedulesJobs` | Register job, start scheduler. Assert `timers()` has a timer for the job. Stop scheduler. |
| `SchedulerStopClearsTimers` | Start with jobs, stop. Assert `timers()` is empty. |
| `SchedulerRegisterWhileRunning` | Start scheduler, then register a new job. Assert the new job gets a timer immediately. Stop scheduler. |

### GeistService scheduler (in `apps/agenda/tests/services/geist.js`)

Source: `GeistService.initScheduler/startScheduler/stopScheduler` in `src/services/geist.js`.

| Test Name | Scenario |
|---|---|
| `GeistServiceInitScheduler` | Call `initScheduler()`. Assert `scheduler()` is not null, has a 'generateHaunts' job. |
| `GeistServiceStartStopScheduler` | Call `startScheduler()`, assert `scheduler().running()` is true. Call `stopScheduler()`, assert false. |
| `GeistServiceStopSchedulerNoInit` | Call `stopScheduler()` without init. Assert no error (no-op). |

## Implementation Notes

- Always call `scheduler.stop()` or `stopScheduler()` in a `finally` block to avoid leaked timers.
- For `ScheduledJob.run()`, the mock action can be a simple counter: `let called = 0; action: async () => { called++; }`.
- For `SchedulerRegisterWhileRunning`, use `Scheduler.timers()` to verify timer was created.
- `initScheduler` requires `promptTimes` to be set (it creates a TimeOfDaySchedule from them). Set `promptTimes(['08:00'])` before calling.

## Files to Modify
- `apps/agenda/tests/time.js`
- `apps/agenda/tests/services/geist.js`

## Acceptance Criteria
- [ ] `ScheduledJob.run()` and `calculateNextRun()` directly tested
- [ ] `Scheduler.register()` and `unregister()` tested with job tracking verification
- [ ] `Scheduler.start()` creates timers, `stop()` clears them
- [ ] GeistService scheduler lifecycle tested (init/start/stop)
- [ ] All timers properly cleaned up (no leaked timers causing test hangs)
- [ ] `TIMEOUT=30 bun run src/runner.js apps/agenda/tests/time.js` passes
- [ ] `TIMEOUT=30 bun run src/runner.js apps/agenda/tests/services/geist.js` passes
- [ ] `bun run test` clean
