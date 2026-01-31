export default [
  {
    name: 'agenda',
    command: ['bun', 'run', 'run.js'],
    cwd: 'apps/agenda',
    env: {
      AGENDA_TIMEZONE: 'America/Los_Angeles',
    },
    stop: { timeoutMs: 3000, signal: 'SIGTERM' },
  },
  {
    name: 'agenda-test',
    command: ['bun', 'run', 'run.js'],
    cwd: 'apps/agenda',
    env: {
      AGENDA_TIMEZONE: 'America/Los_Angeles',
      AGENDA_DB_PATH: 'agenda-test.db',
      AGENDA_PORT: '3031',
    },
    stop: { timeoutMs: 3000, signal: 'SIGTERM' },
  },
  {
    name: 'build-watch',
    command: ['bash', 'bin/build-watch'],
    cwd: '.',
    stop: { timeoutMs: 2000, signal: 'SIGTERM' },
  },
];
