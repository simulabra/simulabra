import { __, base } from '../src/base.js';
import test from '../src/test.js';
import pm from '../src/pm.js';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

export default await async function (_, $, $test, $pm) {
  const TEST_DIR = 'tmp/pm-test';
  const TEST_STATE_DIR = join(TEST_DIR, 'state');
  const TEST_LOG_DIR = join(TEST_DIR, 'logs');

  function cleanup() {
    try { rmSync(TEST_DIR, { recursive: true }); } catch {}
  }

  $test.Case.new({
    name: 'PMPaths_Creation',
    doc: 'PMPaths creates correct file paths',
    do() {
      const paths = $pm.PMPaths.new({
        root: '/test',
        stateDir: 'state',
        logDir: 'logs',
      });

      this.assertEq(paths.statePath(), '/test/state');
      this.assertEq(paths.logPath(), '/test/logs');
      this.assertEq(paths.stateFile('myservice'), '/test/state/myservice.json');
      this.assertEq(paths.lockFile('myservice'), '/test/state/myservice.lock');
      this.assertEq(paths.logFile('myservice'), '/test/logs/myservice.log');
    }
  });

  $test.Case.new({
    name: 'PMPaths_EnsureDirs',
    doc: 'PMPaths.ensureDirs creates directories',
    do() {
      cleanup();
      const paths = $pm.PMPaths.new({
        root: '.',
        stateDir: TEST_STATE_DIR,
        logDir: TEST_LOG_DIR,
      });
      paths.ensureDirs();
      this.assert(existsSync(TEST_STATE_DIR), 'State dir should exist');
      this.assert(existsSync(TEST_LOG_DIR), 'Log dir should exist');
      cleanup();
    }
  });

  $test.Case.new({
    name: 'PMState_Lifecycle',
    doc: 'PMState save and load roundtrip',
    do() {
      cleanup();
      mkdirSync(TEST_STATE_DIR, { recursive: true });

      const state = $pm.PMState.new({
        serviceName: 'test-svc',
        runnerPid: 12345,
        servicePid: 12346,
        status: 'running',
        startedAt: Date.now(),
        command: ['node', 'app.js'],
        logFile: '/tmp/test.log',
      });

      const statePath = join(TEST_STATE_DIR, 'test-svc.json');
      state.save(statePath);

      const loaded = $pm.PMState.load(statePath);
      this.assertEq(loaded.serviceName(), 'test-svc');
      this.assertEq(loaded.runnerPid(), 12345);
      this.assertEq(loaded.servicePid(), 12346);
      this.assertEq(loaded.status(), 'running');
      this.assertEq(loaded.command().length, 2);

      cleanup();
    }
  });

  $test.Case.new({
    name: 'PMState_EffectiveStatus',
    doc: 'PMState detects stale processes',
    do() {
      const state = $pm.PMState.new({
        serviceName: 'fake',
        runnerPid: 999999999,
        status: 'running',
      });
      this.assertEq(state.effectiveStatus(), 'stale');

      const stoppedState = $pm.PMState.new({
        serviceName: 'stopped',
        status: 'stopped',
      });
      this.assertEq(stoppedState.effectiveStatus(), 'stopped');
    }
  });

  $test.Case.new({
    name: 'PMState_LoadMissing',
    doc: 'PMState.load returns null for missing file',
    do() {
      const result = $pm.PMState.load('/nonexistent/path/file.json');
      this.assert(result === null, 'Should return null for missing file');
    }
  });

  $test.Case.new({
    name: 'PMService_Validation',
    doc: 'PMService validates name and command',
    do() {
      const svc = $pm.PMService.new({
        serviceName: 'valid-name_123',
        command: ['node', 'app.js'],
      });
      this.assertEq(svc.serviceName(), 'valid-name_123');

      this.assertThrows(
        () => $pm.PMService.new({ serviceName: '123invalid', command: ['node'] }),
        'Invalid service name',
        'Should reject names starting with number'
      );

      this.assertThrows(
        () => $pm.PMService.new({ serviceName: 'valid', command: [] }),
        'command must be a non-empty array',
        'Should reject empty command'
      );
    }
  });

  $test.Case.new({
    name: 'PMService_FromConfig',
    doc: 'PMService.fromConfig creates from config object',
    do() {
      const svc = $pm.PMService.fromConfig({
        name: 'myapp',
        command: ['bun', 'run', 'app.js'],
        cwd: '/app',
        env: { NODE_ENV: 'production' },
        stop: { timeoutMs: 10000, signal: 'SIGINT' },
      });

      this.assertEq(svc.serviceName(), 'myapp');
      this.assertEq(svc.command().length, 3);
      this.assertEq(svc.cwd(), '/app');
      this.assertEq(svc.env().NODE_ENV, 'production');
      this.assertEq(svc.stop().timeoutMs, 10000);
    }
  });

  $test.AsyncCase.new({
    name: 'PMRegistry_Load',
    doc: 'PMRegistry loads services from config',
    async do() {
      const registry = await $pm.PMRegistry.load('misc/pm/services.js');
      this.assert(registry.names().length > 0, 'Should have services');
      this.assert(registry.names().includes('agenda'), 'Should have agenda service');

      const agenda = registry.get('agenda');
      this.assertEq(agenda.serviceName(), 'agenda');
      this.assert(Array.isArray(agenda.command()), 'Command should be array');
    }
  });

  $test.AsyncCase.new({
    name: 'PMController_List',
    doc: 'PMController.list returns service status',
    async do() {
      cleanup();
      const ctrl = $pm.PMController.new({
        paths: $pm.PMPaths.new({
          stateDir: TEST_STATE_DIR,
          logDir: TEST_LOG_DIR,
        }),
      });

      const result = await ctrl.list({ json: true });
      this.assert(Array.isArray(result), 'Should return array');
      this.assert(result.length > 0, 'Should have services');

      const agenda = result.find(s => s.name === 'agenda');
      this.assert(agenda, 'Should have agenda');
      this.assertEq(agenda.status, 'stopped');

      cleanup();
    }
  });

  $test.AsyncCase.new({
    name: 'PMController_UnknownService',
    doc: 'PMController returns error for unknown service',
    async do() {
      cleanup();
      const ctrl = $pm.PMController.new({
        paths: $pm.PMPaths.new({
          stateDir: TEST_STATE_DIR,
          logDir: TEST_LOG_DIR,
        }),
      });

      const startResult = await ctrl.start('nonexistent');
      this.assertEq(startResult.success, false);
      this.assertEq(startResult.code, 2);

      const stopResult = await ctrl.stop('nonexistent');
      this.assertEq(stopResult.success, false);
      this.assertEq(stopResult.code, 2);

      cleanup();
    }
  });

  $test.AsyncCase.new({
    name: 'PMController_Logfile',
    doc: 'PMController.logfile returns log path',
    async do() {
      cleanup();
      const ctrl = $pm.PMController.new({
        paths: $pm.PMPaths.new({
          stateDir: TEST_STATE_DIR,
          logDir: TEST_LOG_DIR,
        }),
      });

      const result = await ctrl.logfile('agenda');
      this.assertEq(result.success, true);
      this.assert(result.path.includes('agenda.log'), 'Should have agenda.log path');

      cleanup();
    }
  });

  $test.Case.new({
    name: 'PMState_Uptime',
    doc: 'PMState.uptime calculates running time',
    do() {
      const startedAt = Date.now() - 60000;
      const state = $pm.PMState.new({
        serviceName: 'uptime-test',
        runnerPid: process.pid,
        status: 'running',
        startedAt,
      });

      const uptime = state.uptime();
      this.assert(uptime >= 59000 && uptime <= 61000, 'Uptime should be ~60s');

      const stoppedState = $pm.PMState.new({
        serviceName: 'stopped',
        status: 'stopped',
        startedAt,
      });
      this.assertEq(stoppedState.uptime(), null);
    }
  });

  $test.AsyncCase.new({
    name: 'PMController_FormatUptime',
    doc: 'PMController formats uptime strings correctly',
    async do() {
      const ctrl = $pm.PMController.new();

      this.assertEq(ctrl.formatUptime(5000), '5s');
      this.assertEq(ctrl.formatUptime(65000), '1m5s');
      this.assertEq(ctrl.formatUptime(3665000), '1h1m');
    }
  });

}.module({
  name: 'test.pm',
  imports: [base, test, pm],
}).load();
