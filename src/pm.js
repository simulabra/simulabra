import { __, base } from './base.js';
import { join, dirname, resolve } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';

export default await async function (_, $) {
  $.Class.new({
    name: 'PMPaths',
    doc: 'path resolution for PM state and log directories',
    slots: [
      $.Var.new({ name: 'root', default: '.' }),
      $.Var.new({ name: 'stateDir', default: 'tmp/pm' }),
      $.Var.new({ name: 'logDir', default: 'logs/pm' }),
      $.Method.new({
        name: 'statePath',
        do() {
          return join(this.root(), this.stateDir());
        }
      }),
      $.Method.new({
        name: 'logPath',
        do() {
          return join(this.root(), this.logDir());
        }
      }),
      $.Method.new({
        name: 'stateFile',
        do(name) {
          return join(this.statePath(), `${name}.json`);
        }
      }),
      $.Method.new({
        name: 'lockFile',
        do(name) {
          return join(this.statePath(), `${name}.lock`);
        }
      }),
      $.Method.new({
        name: 'logFile',
        do(name) {
          return join(this.logPath(), `${name}.log`);
        }
      }),
      $.Method.new({
        name: 'ensureDirs',
        do() {
          if (!existsSync(this.statePath())) {
            mkdirSync(this.statePath(), { recursive: true });
          }
          if (!existsSync(this.logPath())) {
            mkdirSync(this.logPath(), { recursive: true });
          }
        }
      }),
    ]
  });

  $.Class.new({
    name: 'PMState',
    doc: 'state file schema v1 for service state persistence',
    slots: [
      $.Var.new({ name: 'serviceName', required: true }),
      $.Var.new({ name: 'runnerPid' }),
      $.Var.new({ name: 'servicePid' }),
      $.Var.new({ name: 'status', default: 'stopped' }),
      $.Var.new({ name: 'startedAt' }),
      $.Var.new({ name: 'command', default: () => [] }),
      $.Var.new({ name: 'logFile' }),
      $.Var.new({ name: 'lastExit' }),
      $.Static.new({
        name: 'load',
        do(path) {
          if (!existsSync(path)) return null;
          try {
            const data = JSON.parse(readFileSync(path, 'utf-8'));
            return this.new({
              serviceName: data.name,
              runnerPid: data.runnerPid,
              servicePid: data.servicePid,
              status: data.status || 'stopped',
              startedAt: data.startedAt,
              command: data.command || [],
              logFile: data.logFile,
              lastExit: data.lastExit,
            });
          } catch {
            return null;
          }
        }
      }),
      $.Method.new({
        name: 'save',
        do(path) {
          writeFileSync(path, JSON.stringify(this.toJSON(), null, 2));
        }
      }),
      $.Method.new({
        name: 'toJSON',
        do() {
          return {
            version: 1,
            name: this.serviceName(),
            runnerPid: this.runnerPid(),
            servicePid: this.servicePid(),
            status: this.status(),
            startedAt: this.startedAt(),
            command: this.command(),
            logFile: this.logFile(),
            lastExit: this.lastExit(),
          };
        }
      }),
      $.Method.new({
        name: 'isAlive',
        do() {
          if (!this.runnerPid()) return false;
          try {
            process.kill(this.runnerPid(), 0);
            return true;
          } catch {
            return false;
          }
        }
      }),
      $.Method.new({
        name: 'effectiveStatus',
        do() {
          if (this.status() === 'running' && !this.isAlive()) {
            return 'stale';
          }
          return this.status();
        }
      }),
      $.Method.new({
        name: 'uptime',
        do() {
          if (!this.startedAt() || this.effectiveStatus() !== 'running') return null;
          return Date.now() - this.startedAt();
        }
      }),
    ]
  });

  $.Class.new({
    name: 'PMService',
    doc: 'validated service definition from registry',
    slots: [
      $.Var.new({ name: 'serviceName', required: true }),
      $.Var.new({ name: 'command', required: true }),
      $.Var.new({ name: 'cwd', default: '.' }),
      $.Var.new({ name: 'env', default: () => ({}) }),
      $.Var.new({ name: 'log' }),
      $.Var.new({ name: 'stop', default: () => ({ timeoutMs: 5000, signal: 'SIGTERM' }) }),
      $.After.new({
        name: 'init',
        do() {
          if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(this.serviceName())) {
            throw new Error(`Invalid service name: ${this.serviceName()}`);
          }
          if (!Array.isArray(this.command()) || this.command().length === 0) {
            throw new Error(`Service ${this.serviceName()} command must be a non-empty array`);
          }
        }
      }),
      $.Static.new({
        name: 'fromConfig',
        do(config) {
          return this.new({
            serviceName: config.name,
            command: config.command,
            cwd: config.cwd || '.',
            env: config.env || {},
            log: config.log,
            stop: config.stop || { timeoutMs: 5000, signal: 'SIGTERM' },
          });
        }
      }),
    ]
  });

  $.Class.new({
    name: 'PMRegistry',
    doc: 'loads service definitions from config file',
    slots: [
      $.Var.new({ name: 'services', default: () => ({}) }),
      $.Static.new({
        name: 'load',
        async do(configPath) {
          const registry = this.new();
          const absolutePath = resolve(configPath);
          const config = await import(absolutePath);
          const services = config.default || [];
          for (const svcConfig of services) {
            const svc = _.PMService.fromConfig(svcConfig);
            registry.services()[svc.serviceName()] = svc;
          }
          return registry;
        }
      }),
      $.Method.new({
        name: 'get',
        do(name) {
          return this.services()[name];
        }
      }),
      $.Method.new({
        name: 'all',
        do() {
          return Object.values(this.services());
        }
      }),
      $.Method.new({
        name: 'names',
        do() {
          return Object.keys(this.services());
        }
      }),
    ]
  });

  $.Class.new({
    name: 'PMRunner',
    doc: 'per-service runner for managing child process lifecycle',
    slots: [
      $.Var.new({ name: 'service', required: true }),
      $.Var.new({ name: 'paths', required: true }),
      $.Var.new({ name: 'state' }),
      $.Var.new({ name: 'childProcess' }),
      $.Var.new({ name: 'logStream' }),
      $.Var.new({ name: 'shuttingDown', default: false }),
      $.Method.new({
        name: 'start',
        async do() {
          this.paths().ensureDirs();
          const logFile = this.paths().logFile(this.service().serviceName());
          this.state(_.PMState.new({
            serviceName: this.service().serviceName(),
            runnerPid: process.pid,
            status: 'starting',
            startedAt: Date.now(),
            command: this.service().command(),
            logFile: resolve(logFile),
          }));
          this.writeState();
          await this.openLog();
          this.setupSignalHandlers();
          await this.spawnChild();
        }
      }),
      $.Method.new({
        name: 'openLog',
        async do() {
          const file = Bun.file(this.state().logFile());
          this.logStream(file.writer());
        }
      }),
      $.Method.new({
        name: 'writeLog',
        do(message) {
          const timestamp = new Date().toISOString();
          this.logStream()?.write(`[${timestamp}] ${message}\n`);
        }
      }),
      $.Method.new({
        name: 'writeState',
        do() {
          const stateFile = this.paths().stateFile(this.service().serviceName());
          this.state().save(stateFile);
        }
      }),
      $.Method.new({
        name: 'spawnChild',
        async do() {
          const cmd = this.service().command();
          const cwd = resolve(this.paths().root(), this.service().cwd());
          const env = { ...process.env, ...this.service().env() };

          this.writeLog(`Starting: ${cmd.join(' ')}`);
          this.writeLog(`CWD: ${cwd}`);

          const child = Bun.spawn(cmd, {
            cwd,
            env,
            stdout: 'pipe',
            stderr: 'pipe',
          });

          this.childProcess(child);
          this.state().servicePid(child.pid);
          this.state().status('running');
          this.writeState();

          this.writeLog(`Service started with PID ${child.pid}`);

          this.pipeOutput(child.stdout, 'stdout');
          this.pipeOutput(child.stderr, 'stderr');

          const exitCode = await child.exited;
          this.handleChildExit(exitCode);
        }
      }),
      $.Method.new({
        name: 'pipeOutput',
        async do(stream, label) {
          const reader = stream.getReader();
          const decoder = new TextDecoder();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const text = decoder.decode(value, { stream: true });
              for (const line of text.split('\n')) {
                if (line) this.writeLog(`[${label}] ${line}`);
              }
            }
          } catch (e) {
            if (!this.shuttingDown()) {
              this.writeLog(`[${label}] pipe error: ${e.message}`);
            }
          }
        }
      }),
      $.Method.new({
        name: 'handleChildExit',
        do(exitCode) {
          this.writeLog(`Service exited with code ${exitCode}`);
          this.state().status('stopped');
          this.state().lastExit({ code: exitCode, time: Date.now() });
          this.state().servicePid(null);
          this.state().runnerPid(null);
          this.writeState();
          this.logStream()?.end();
          if (!this.shuttingDown()) {
            process.exit(exitCode);
          }
        }
      }),
      $.Method.new({
        name: 'setupSignalHandlers',
        do() {
          const gracefulShutdown = async (signal) => {
            if (this.shuttingDown()) return;
            this.shuttingDown(true);
            this.writeLog(`Received ${signal}, shutting down...`);

            const child = this.childProcess();
            if (child) {
              const stopConfig = this.service().stop();
              const sig = stopConfig.signal || 'SIGTERM';
              const timeout = stopConfig.timeoutMs || 5000;

              try {
                process.kill(child.pid, sig);
              } catch {}

              const forceKillTimeout = setTimeout(() => {
                try {
                  process.kill(child.pid, 'SIGKILL');
                } catch {}
              }, timeout);

              await child.exited;
              clearTimeout(forceKillTimeout);
            }

            this.state().status('stopped');
            this.state().runnerPid(null);
            this.state().servicePid(null);
            this.writeState();
            this.logStream()?.end();
            process.exit(0);
          };

          process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
          process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        }
      }),
    ]
  });

  $.Class.new({
    name: 'PMController',
    doc: 'CLI operations controller for managing services',
    slots: [
      $.Var.new({ name: 'paths' }),
      $.Var.new({ name: 'registry' }),
      $.Var.new({ name: 'configPath', default: 'misc/pm/services.js' }),
      $.After.new({
        name: 'init',
        do() {
          if (!this.paths()) {
            this.paths(_.PMPaths.new());
          }
        }
      }),
      $.Method.new({
        name: 'loadRegistry',
        async do() {
          if (!this.registry()) {
            this.registry(await _.PMRegistry.load(this.configPath()));
          }
          return this.registry();
        }
      }),
      $.Method.new({
        name: 'list',
        async do(options = {}) {
          await this.loadRegistry();
          this.paths().ensureDirs();
          const services = this.registry().all();
          const result = [];

          for (const svc of services) {
            const stateFile = this.paths().stateFile(svc.serviceName());
            const state = _.PMState.load(stateFile);
            result.push({
              name: svc.serviceName(),
              status: state?.effectiveStatus() || 'stopped',
              pid: state?.servicePid() || null,
              runnerPid: state?.runnerPid() || null,
              uptime: state?.uptime() || null,
              logFile: state?.logFile() || this.paths().logFile(svc.serviceName()),
            });
          }

          if (options.json) {
            return result;
          }

          if (result.length === 0) {
            return 'No services defined.';
          }

          const lines = ['SERVICE         STATUS      PID     UPTIME'];
          for (const svc of result) {
            const uptimeStr = svc.uptime ? this.formatUptime(svc.uptime) : '-';
            const pidStr = svc.pid || '-';
            lines.push(
              `${svc.name.padEnd(15)} ${svc.status.padEnd(11)} ${String(pidStr).padEnd(7)} ${uptimeStr}`
            );
          }
          return lines.join('\n');
        }
      }),
      $.Method.new({
        name: 'formatUptime',
        do(ms) {
          const seconds = Math.floor(ms / 1000);
          const minutes = Math.floor(seconds / 60);
          const hours = Math.floor(minutes / 60);
          if (hours > 0) {
            return `${hours}h${minutes % 60}m`;
          } else if (minutes > 0) {
            return `${minutes}m${seconds % 60}s`;
          }
          return `${seconds}s`;
        }
      }),
      $.Method.new({
        name: 'start',
        async do(name, options = {}) {
          await this.loadRegistry();
          const svc = this.registry().get(name);
          if (!svc) {
            return { success: false, code: 2, message: `Unknown service: ${name}` };
          }

          const stateFile = this.paths().stateFile(name);
          const existingState = _.PMState.load(stateFile);
          if (existingState?.effectiveStatus() === 'running') {
            return {
              success: true,
              code: 0,
              message: `${name} already running (pid ${existingState.servicePid()})`,
              pid: existingState.servicePid()
            };
          }

          const lockFile = this.paths().lockFile(name);
          if (existsSync(lockFile)) {
            return { success: false, code: 4, message: `${name} is already starting` };
          }

          try {
            writeFileSync(lockFile, String(process.pid));
            this.paths().ensureDirs();

            const runnerPath = join(dirname(import.meta.path), '..', 'bin', 'pm-runner.js');
            const child = Bun.spawn(['bun', 'run', runnerPath, name], {
              cwd: this.paths().root(),
              env: {
                ...process.env,
                PM_CONFIG: resolve(this.configPath()),
                PM_STATE_DIR: this.paths().stateDir(),
                PM_LOG_DIR: this.paths().logDir(),
              },
              stdio: ['ignore', 'ignore', 'ignore'],
              detached: true,
            });
            child.unref();

            await __.sleep(200);
            const newState = _.PMState.load(stateFile);
            if (newState?.effectiveStatus() === 'running') {
              return {
                success: true,
                code: 0,
                message: `Started ${name} (pid ${newState.servicePid()})`,
                pid: newState.servicePid()
              };
            }

            return { success: true, code: 0, message: `Starting ${name}...` };
          } finally {
            try { unlinkSync(lockFile); } catch {}
          }
        }
      }),
      $.Method.new({
        name: 'stop',
        async do(name, options = {}) {
          await this.loadRegistry();
          const svc = this.registry().get(name);
          if (!svc) {
            return { success: false, code: 2, message: `Unknown service: ${name}` };
          }

          const stateFile = this.paths().stateFile(name);
          const state = _.PMState.load(stateFile);
          if (!state || state.effectiveStatus() !== 'running') {
            if (state?.effectiveStatus() === 'stale') {
              state.status('stopped');
              state.runnerPid(null);
              state.servicePid(null);
              state.save(stateFile);
              return { success: true, code: 0, message: `Cleaned up stale state for ${name}` };
            }
            return { success: false, code: 3, message: `${name} is not running` };
          }

          const runnerPid = state.runnerPid();
          const timeout = options.timeout || svc.stop().timeoutMs || 5000;

          try {
            process.kill(runnerPid, 'SIGTERM');
          } catch (e) {
            state.status('stopped');
            state.runnerPid(null);
            state.servicePid(null);
            state.save(stateFile);
            return { success: true, code: 0, message: `${name} stopped (runner already dead)` };
          }

          const startTime = Date.now();
          while (Date.now() - startTime < timeout) {
            await __.sleep(100);
            const newState = _.PMState.load(stateFile);
            if (!newState || newState.effectiveStatus() !== 'running') {
              return { success: true, code: 0, message: `Stopped ${name}` };
            }
          }

          if (options.force) {
            try {
              process.kill(runnerPid, 'SIGKILL');
            } catch {}
            state.status('stopped');
            state.runnerPid(null);
            state.servicePid(null);
            state.save(stateFile);
            return { success: true, code: 0, message: `Force killed ${name}` };
          }

          return { success: false, code: 5, message: `Timeout stopping ${name}` };
        }
      }),
      $.Method.new({
        name: 'restart',
        async do(name, options = {}) {
          const stopResult = await this.stop(name, options);
          if (!stopResult.success && stopResult.code !== 3) {
            return stopResult;
          }
          await __.sleep(100);
          return this.start(name, options);
        }
      }),
      $.Method.new({
        name: 'logfile',
        async do(name) {
          await this.loadRegistry();
          const svc = this.registry().get(name);
          if (!svc) {
            return { success: false, code: 2, message: `Unknown service: ${name}` };
          }
          const stateFile = this.paths().stateFile(name);
          const state = _.PMState.load(stateFile);
          const logPath = state?.logFile() || resolve(this.paths().logFile(name));
          return { success: true, code: 0, path: logPath };
        }
      }),
    ]
  });

}.module({
  name: 'pm',
  imports: [base],
}).load();
