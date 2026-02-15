# WORKLOG - agenda-review

## 2026-02-14

Project created for ongoing agenda code review. Goal: capture observations and analysis to feed back into the core Simulabra framework.

### Observation 1: Defensive DB guards in GeistService
- 6 sites in geist.js check `if (!db)` and return `{ success: false, error: '...' }`
- 2 sites check `if (!this.client())` similarly
- Lines: 143, 207-210, 245-250, 336-341, 447-449, 489-495
- User's take: crash the service, restart with linear backoff 1-10s
- Framework angle: ManagedService has exponential backoff (1s→60s). Could support linear backoff mode. Services should be able to declare required dependencies and crash cleanly if they're missing.
