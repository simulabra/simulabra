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
];
