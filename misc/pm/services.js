export default [
  {
    name: 'agenda',
    command: ['bun', 'run', 'run.js'],
    cwd: 'apps/agenda',
    env: {},
    stop: { timeoutMs: 3000, signal: 'SIGTERM' },
  },
];
