<ProductRequirementDocument>
Simulabra Agenda is the personal productivity system that I have been wanting to build for a while, after finding the alternatives wanting.
It is accessed either as a typical web application or via sms, which interprets messages into the same commands used in the application, either directly via forms like `/log remember this` or indirectly from the context.

<DataModel>
<ItemTypes>
Three core item types, all stored in Redis with full-text search capability:

<Log>
- id: uuid
- content: string (the journal entry text)
- timestamp: datetime
- tags: string[] (extracted from content or explicit)
</Log>

<Task>
- id: uuid
- title: string
- done: boolean
- priority: enum (P1, P2, P3) - high, medium, low
- due_date: datetime (optional)
- created_at: datetime
- completed_at: datetime (optional)
</Task>

<Reminder>
- id: uuid
- message: string (what to remind about)
- trigger_at: datetime
- recurrence: RecurrenceRule (optional)
- sent: boolean
- created_at: datetime
</Reminder>

<RecurrenceRule>
- pattern: enum (daily, weekly, monthly)
- interval: number (every N days/weeks/months)
- days_of_week: number[] (for weekly: 0=Sun, 6=Sat)
- end_date: datetime (optional)
</RecurrenceRule>
</ItemTypes>

<Storage>
- Redis for primary data storage
- Redis Streams for change feed (event sourcing pattern)
- Redis Search for full-text search across all items
</Storage>
</DataModel>

<Clients>
<WebClient>
- web application (pattern off demos/dummy/client.js and demos/loom.js)
- accessed over tailscale, don't worry about auth for now
- dual-purpose chat window:
  - displays activity log (commands executed, system events)
  - allows direct interaction with the geist (natural language input)
- custom views for different item types (logs, tasks, reminders)
</WebClient>

<SMSClient>
- Twilio integration for sending/receiving SMS
- text an agent with commands like `/log remember this`
- natural language messages are interpreted by the geist
- receives reminders and follow-ups via SMS
</SMSClient>

<CLIClient>
- one-shot mode: `bun run agenda-cli log 'remember this'`
- interactive REPL mode: `bun run agenda-cli` or `bun run agenda-cli --interactive`
- same command parsing as SMS client
</CLIClient>
</Clients>

<Services>
Services coordinate via the live system (WebSocket RPC).

<DatabaseService>
- CRUD operations for all item types
- fetches data from Redis
- processes the change feed (Redis Streams consumer)
- exposes RPC methods for clients
</DatabaseService>

<ReminderService>
- polls for due reminders
- handles recurring reminder logic (creates next occurrence)
- triggers notifications via SMS or web push
- marks reminders as sent
</ReminderService>

<GeistService>
- powered by Claude API
- interprets natural language input into structured commands
- has access to tools:
  - create_log(content)
  - create_task(title, priority?, due_date?)
  - complete_task(id)
  - create_reminder(message, when, recurrence?)
  - search(query)
  - list_tasks(filter?)
  - list_reminders()
  - trigger_webhook(url, payload)
- webhook automation for integrations
</GeistService>
</Services>

<Components>
UI components and their conceptual purpose:

<Todos>
- classic todo list, but llms make you accountable
- see active todos (should be 10 or less) with status
- expand todo for detailed history
</Todos>

<Journal>
- timestamped log of random ideas and tidbits
- can be searched and queried
- recollect past thoughts by topic
</Journal>

<Calendar>
- view of upcoming events and reminders
- sends notifications of reminders
</Calendar>
</Components>

<Commands>
<Log>
<SMSFormat>`log something to say` or `/log something to say`</SMSFormat>
<Description>saves the argument to a searchable journal, with a timestamp</Description>
</Log>

<Task>
<SMSFormat>`task buy groceries P2` or `todo fix the bug by friday`</SMSFormat>
<Description>creates a task with optional priority and due date</Description>
</Task>

<Done>
<SMSFormat>`done buy groceries` or `complete 3`</SMSFormat>
<Description>marks a task as completed by title match or number</Description>
</Done>

<RemindMe>
<SMSFormat>`remind me to check for 4b history llm upload in a week`</SMSFormat>
<SMSFormat>`remind me every monday at 9am to review the week`</SMSFormat>
<Description>instruct the system to remind you of something at a later date, supports one-time and recurring</Description>
</RemindMe>

<Search>
<SMSFormat>`search groceries` or `find meetings from last week`</SMSFormat>
<SMSFormat>`recollect what i was thinking about claude`</SMSFormat>
<Description>full-text search across all items, looks through the journal for entries related to the query</Description>
</Search>

<List>
<SMSFormat>`list tasks` or `show P1 tasks` or `reminders`</SMSFormat>
<Description>lists items with optional filters</Description>
</List>
</Commands>

<Architecture>
```
                    +------------------+
                    |   Twilio SMS     |
                    +--------+---------+
                             |
+-------------+    +---------v---------+    +------------------+
|  Web Client +--->|   AgendaServer    |<---+   CLI Client     |
+-------------+    |  (WebSocket RPC)  |    +------------------+
                   +----+----+----+----+
                        |    |    |
          +-------------+    |    +-------------+
          |                  |                  |
   +------v------+    +------v------+    +------v------+
   | Database    |    | Reminder    |    | Geist       |
   | Service     |    | Service     |    | Service     |
   +------+------+    +------+------+    +------+------+
          |                  |                  |
          +--------+---------+                  |
                   |                            |
            +------v------+              +------v------+
            |    Redis    |              | Claude API  |
            | + Streams   |              +-------------+
            | + Search    |
            +-------------+
```
</Architecture>

<Deployment>
Single server deployment with Simulabra-native process supervision.

<Supervisor>
A custom Simulabra Supervisor manages service lifecycles:

<SupervisorClass>
- runs as the master process
- hosts the WebSocket RPC server
- spawns child processes for each service using Bun.spawn()
- monitors child process health (exit codes, heartbeats)
- restarts crashed services with exponential backoff (1s, 2s, 4s, 8s... max 60s)
- resets backoff counter after 60s of successful operation
- logs all lifecycle events to stdout/file
</SupervisorClass>

<ServiceSpec>
Each service is defined by a spec:
- name: string (e.g., "DatabaseService")
- command: string[] (e.g., ["bun", "run", "services/database.js"])
- restart_policy: enum (always, on_failure, never)
- max_restarts: number (give up after N consecutive failures, default 10)
- health_check: optional periodic RPC call to verify service is responsive
</ServiceSpec>

<Communication>
- All services connect to master via WebSocket (localhost:3030)
- Uniform protocol whether local or remote
- Master routes messages between services and clients
- Services register their RPC methods on connect
</Communication>
</Supervisor>

<ProcessTree>
```
agenda-supervisor (master)
├── WebSocket Server (:3030)
├── HTTP Server (:3031 for Twilio webhooks)
│
├── [child] database-service
│   └── connects to master via WS
│   └── connects to Redis
│
├── [child] reminder-service
│   └── connects to master via WS
│   └── calls DatabaseService via RPC
│
└── [child] geist-service
    └── connects to master via WS
    └── calls Claude API
    └── calls DatabaseService via RPC
```
</ProcessTree>

<Production>
- Single server accessed via Tailscale
- Run with: `bun run agenda-supervisor`
- Optional: single systemd user unit for the supervisor
- Logs to stdout (journald captures) or ~/agenda/logs/
- Redis runs separately (system service or container)
</Production>

<Configuration>
Environment-based configuration:
- AGENDA_REDIS_URL: Redis connection string
- AGENDA_TWILIO_SID: Twilio account SID
- AGENDA_TWILIO_TOKEN: Twilio auth token
- AGENDA_TWILIO_PHONE: Twilio phone number
- AGENDA_CLAUDE_KEY: Anthropic API key
- AGENDA_PORT: WebSocket server port (default 3030)
- AGENDA_HTTP_PORT: HTTP server port (default 3031)
</Configuration>
</Deployment>
</ProductRequirementDocument>
