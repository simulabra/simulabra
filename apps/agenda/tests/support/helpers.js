import { __, base } from 'simulabra';

export default await async function (_, $) {
  let savedDebugLog = null;

  // Prefixes to silence (service output, supervisor output)
  const SILENCED_PREFIXES = [
    '$services.',
    '$supervisor.',
    '$redis.',
  ];

  $.Class.new({
    name: 'TestHelpers',
    doc: 'Utilities for cleaner test output',
    slots: [
      $.Static.new({
        name: 'silenceLogs',
        doc: 'suppress service/supervisor log output during tests',
        do() {
          if (!savedDebugLog && __.$$DebugClass) {
            savedDebugLog = __.$$DebugClass.log;
            __.$$DebugClass.log = function(...args) {
              // Check if any arg starts with a silenced prefix
              const shouldSilence = args.some(arg => {
                if (typeof arg !== 'string') return false;
                return SILENCED_PREFIXES.some(prefix => arg.startsWith(prefix));
              });
              if (!shouldSilence) {
                savedDebugLog.call(this, ...args);
              }
            };
          }
        }
      }),
      $.Static.new({
        name: 'restoreLogs',
        doc: 'restore normal logging after tests',
        do() {
          if (savedDebugLog && __.$$DebugClass) {
            __.$$DebugClass.log = savedDebugLog;
            savedDebugLog = null;
          }
        }
      }),
    ]
  });

  // Auto-silence when this module is loaded in test context
  _.TestHelpers.silenceLogs();
}.module({
  name: 'test.helpers',
  imports: [base],
}).load();
