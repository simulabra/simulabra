import { __, base } from 'simulabra';
import live from 'simulabra/live';
import { appendFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export default await async function (_, $, $live) {
  $.Class.new({
    name: 'AgendaService',
    doc: 'Base mixin for Agenda services - handles automatic uid from env',
    slots: [
      $live.NodeClient,
      $.After.new({
        name: 'init',
        do() {
          const envName = process.env.AGENDA_SERVICE_NAME;
          if (envName) {
            this.uid(envName);
          } else if (!this.uid()) {
            this.uid(this.class().name);
          }
          // Mute health check logging by default
          this.muteRpcMethod('health');
        }
      }),
      $live.RpcMethod.new({
        name: 'health',
        doc: 'default health check endpoint',
        do() {
          return {
            status: 'ok',
            service: this.uid(),
          };
        }
      }),
      $.Method.new({
        name: 'waitForService',
        doc: 'wait for another service to be available by polling its health endpoint',
        async do(c) {
          const name = c.name;
          const timeoutMs = c.timeoutMs ?? 10000;
          const retryDelayMs = c.retryDelayMs ?? 200;
          const startTime = Date.now();

          while (Date.now() - startTime < timeoutMs) {
            try {
              const proxy = await this.serviceProxy({ name, timeout: 2 });
              await proxy.health();
              return true;
            } catch (e) {
              const delay = Math.min(retryDelayMs * Math.pow(2, Math.floor((Date.now() - startTime) / 1000)), 2000);
              await __.sleep(delay);
            }
          }
          throw new Error(`service ${name} not available after ${timeoutMs}ms`);
        }
      }),
    ]
  });

  $.Class.new({
    name: 'ServiceSpec',
    doc: 'Specification for a managed service',
    slots: [
      $.Var.new({
        name: 'serviceName',
        doc: 'unique name for the service',
        required: true,
      }),
      $.Var.new({
        name: 'command',
        doc: 'command array to spawn the service',
        required: true,
      }),
      $.EnumVar.new({
        name: 'restartPolicy',
        doc: 'when to restart the service',
        choices: ['always', 'on_failure', 'never'],
        default: 'on_failure',
      }),
      $.Var.new({
        name: 'maxRestarts',
        doc: 'max consecutive restarts before giving up',
        default: 10,
      }),
      $.Var.new({
        name: 'healthCheckMethod',
        doc: 'RPC method to call for health checks',
        default: 'health',
      }),
      $.Var.new({
        name: 'healthCheckEnabled',
        doc: 'whether to perform RPC health checks',
        default: true,
      }),
    ]
  });

  $.Class.new({
    name: 'NodeRegistry',
    doc: 'Registry for managing connected service nodes',
    slots: [
      $.Var.new({ name: 'nodes' }),
      $.After.new({
        name: 'init',
        do() {
          this.nodes({});
        }
      }),
      $.Method.new({
        name: 'register',
        doc: 'register a node by name',
        do(name, node) {
          this.nodes()[name] = node;
          return node;
        }
      }),
      $.Method.new({
        name: 'unregister',
        doc: 'remove a node by name',
        do(name) {
          const node = this.nodes()[name];
          delete this.nodes()[name];
          return node;
        }
      }),
      $.Method.new({
        name: 'get',
        doc: 'get a node by name',
        do(name) {
          return this.nodes()[name];
        }
      }),
      $.Method.new({
        name: 'findBySocket',
        doc: 'find a node by its socket',
        do(socket) {
          for (const [name, node] of Object.entries(this.nodes())) {
            if (node.socket() === socket) {
              return { name, node };
            }
          }
          return null;
        }
      }),
      $.Method.new({
        name: 'isConnected',
        doc: 'check if a node is registered and connected',
        do(name) {
          const node = this.get(name);
          return node && node.connected();
        }
      }),
      $.Method.new({
        name: 'all',
        doc: 'return all registered nodes as entries',
        do() {
          return Object.entries(this.nodes());
        }
      }),
    ]
  });

  $.Class.new({
    name: 'HealthCheck',
    doc: 'Performs RPC health checks on managed services',
    slots: [
      $.Var.new({ name: 'supervisor', required: true }),
      $.Var.new({ name: 'timeoutMs', default: 5000 }),
      $.Method.new({
        name: 'check',
        doc: 'perform health check on a managed service via RPC',
        async do(managed) {
          const spec = managed.spec();
          const serviceName = spec.serviceName();

          if (!spec.healthCheckEnabled()) {
            return { healthy: managed.healthy(), skipped: true };
          }

          const node = this.supervisor().nodeRegistry().get(serviceName);
          if (!node || !node.connected()) {
            return { healthy: false, reason: 'disconnected' };
          }

          try {
            const proxy = await this.supervisor().serviceProxy({ name: serviceName });
            const method = spec.healthCheckMethod();
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('health check timeout')), this.timeoutMs());
            });
            const checkPromise = proxy[method]();
            await Promise.race([checkPromise, timeoutPromise]);
            return { healthy: true };
          } catch (err) {
            return { healthy: false, reason: err.message || String(err) };
          }
        }
      }),
    ]
  });

  $.Class.new({
    name: 'ManagedService',
    doc: 'Runtime state for a managed service process',
    slots: [
      $.Var.new({ name: 'spec', required: true }),
      $.Var.new({ name: 'process' }),
      $.Var.new({ name: 'restartCount', default: 0 }),
      $.Var.new({ name: 'lastStart' }),
      $.Var.new({ name: 'backoffMs', default: 1000 }),
      $.Var.new({ name: 'healthy', default: false }),
      $.Var.new({ name: 'healthState', default: 'unknown' }),
      $.Var.new({ name: 'lastHealthCheck' }),
      $.Var.new({ name: 'consecutiveFailures', default: 0 }),
      $.Var.new({ name: 'supervisor' }),
      $.Var.new({ name: 'stopped', default: false }),
      $.Var.new({ name: 'logFile' }),
      $.Method.new({
        name: 'start',
        async do() {
          if (this.stopped()) {
            return;
          }
          const cmd = this.spec().command();
          const serviceName = this.spec().serviceName();
          this.tlog(`starting service ${serviceName}:`, cmd.join(' '));
          this.lastStart(new Date());

          // Set up log file
          const logsDir = this.supervisor()?.logsDir() || 'logs';
          const logPath = join(logsDir, `${serviceName}.log`);
          this.logFile(logPath);

          const self = this;
          // Use shell redirection to write to log file
          const shellCmd = `${cmd.join(' ')} >> "${logPath}" 2>&1`;
          this.process(Bun.spawn(['sh', '-c', shellCmd], {
            cwd: process.cwd(),
            stdout: 'inherit',
            stderr: 'inherit',
            env: {
              ...process.env,
              SIMULABRA_PORT: this.supervisor()?.port() || 3030,
              AGENDA_SERVICE_NAME: serviceName,
            },
            onExit(proc, exitCode, signalCode, error) {
              self.onExit(exitCode, signalCode, error);
            }
          }));
        }
      }),
      $.Method.new({
        name: 'onExit',
        do(exitCode, signalCode, error) {
          this.markUnhealthy(`exited with code=${exitCode}, signal=${signalCode}`);
          if (this.stopped()) {
            this.tlog(`service ${this.spec().serviceName()} stopped`);
            return;
          }

          this.tlog(`service ${this.spec().serviceName()} exited: code=${exitCode}, signal=${signalCode}`);

          const shouldRestart = this.shouldRestart(exitCode);
          if (!shouldRestart) {
            this.tlog(`service ${this.spec().serviceName()} will not restart`);
            return;
          }

          if (this.restartCount() >= this.spec().maxRestarts()) {
            this.tlog(`service ${this.spec().serviceName()} exceeded max restarts (${this.spec().maxRestarts()})`);
            return;
          }

          this.restartCount(this.restartCount() + 1);
          const backoff = this.backoffMs();
          this.backoffMs(Math.min(backoff * 2, 60000));

          this.tlog(`restarting ${this.spec().serviceName()} in ${backoff}ms (attempt ${this.restartCount()})`);
          setTimeout(() => this.start(), backoff);
        }
      }),
      $.Method.new({
        name: 'shouldRestart',
        do(exitCode) {
          const policy = this.spec().restartPolicy();
          if (policy === 'never') return false;
          if (policy === 'always') return true;
          if (policy === 'on_failure') return exitCode !== 0;
          return false;
        }
      }),
      $.Method.new({
        name: 'stop',
        do() {
          this.stopped(true);
          if (this.process()) {
            this.tlog(`stopping service ${this.spec().serviceName()}`);
            this.process().kill();
          }
        }
      }),
      $.Method.new({
        name: 'resetBackoff',
        doc: 'reset backoff after successful operation',
        do() {
          this.backoffMs(1000);
          this.restartCount(0);
        }
      }),
      $.Method.new({
        name: 'markHealthy',
        doc: 'transition to healthy state',
        do() {
          const wasHealthy = this.healthy();
          this.healthy(true);
          this.healthState('healthy');
          this.consecutiveFailures(0);
          this.lastHealthCheck(new Date());
          if (!wasHealthy) {
            this.resetBackoff();
          }
        }
      }),
      $.Method.new({
        name: 'markUnhealthy',
        doc: 'transition to unhealthy state',
        do(reason) {
          const wasHealthy = this.healthy();
          this.healthy(false);
          this.healthState('unhealthy');
          this.consecutiveFailures(this.consecutiveFailures() + 1);
          this.lastHealthCheck(new Date());
          if (wasHealthy) {
            this.tlog(`${this.spec().serviceName()} became unhealthy: ${reason}`);
          }
        }
      }),
    ]
  });

  $.Class.new({
    name: 'HandshakeHandler',
    doc: 'Handler for service registration',
    slots: [
      $live.MessageHandler,
      $.Constant.new({
        name: 'topic',
        value: 'handshake'
      }),
      $.Method.new({
        name: 'handle',
        do({ master, message, socket }) {
          const from = message.from();
          master.tlog(`service connected: ${from}`);
          const node = $live.NodeClient.new({ socket });
          node.uid(from);
          node.connected(true);
          node.responseMap({});
          node.muteRpcMethod('health');
          node.registerHandler($live.ResponseHandler.new());
          node.registerHandler($live.ErrorHandler.new());
          master.nodeRegistry().register(from, node);

          const managed = master.services()[from];
          if (managed) {
            managed.markHealthy();
          }
        }
      })
    ]
  });

  $.Class.new({
    name: 'Supervisor',
    doc: 'Master process that manages service lifecycles',
    slots: [
      $.Var.new({ name: 'port', default: 3030 }),
      $.Var.new({ name: 'logsDir', default: 'logs' }),
      $.Var.new({ name: 'logFile' }),
      $.Var.new({ name: 'nodeRegistry' }),
      $.Var.new({ name: 'healthChecker' }),
      $.Var.new({ name: 'handlers' }),
      $.Var.new({ name: 'services' }),
      $.Var.new({ name: 'specs', default: () => [] }),
      $.Var.new({ name: 'healthCheckIntervalMs', default: 10000 }),
      $.Var.new({ name: 'healthCheckTimeoutMs', default: 5000 }),
      $.Var.new({ name: 'running', default: false }),
      $.After.new({
        name: 'init',
        do() {
          this.nodeRegistry(_.NodeRegistry.new());
          this.healthChecker(_.HealthCheck.new({
            supervisor: this,
            timeoutMs: this.healthCheckTimeoutMs(),
          }));
          this.handlers({});
          this.services({});
          this.registerHandler(_.HandshakeHandler.new());
          // Ensure logs directory exists
          if (!existsSync(this.logsDir())) {
            mkdirSync(this.logsDir(), { recursive: true });
          }
          // Set up supervisor log file
          const logPath = join(this.logsDir(), 'supervisor.log');
          this.logFile(logPath);
          // Create empty log file
          writeFileSync(logPath, '');
        }
      }),
      $.Method.new({
        name: 'registerHandler',
        doc: 'register a message handler by topic',
        do(handler) {
          this.handlers()[handler.topic()] = handler;
        }
      }),
      $.Method.new({
        name: 'writeLog',
        doc: 'write a line to the supervisor log',
        do(message) {
          const line = `[${new Date().toISOString()}] [supervisor] ${message}\n`;
          appendFileSync(this.logFile(), line);
        }
      }),
      $.Method.new({
        name: 'nodes',
        doc: 'backwards-compatible access to node registry nodes',
        do() {
          return this.nodeRegistry().nodes();
        }
      }),
      $.Method.new({
        name: 'node',
        do(name) {
          return this.nodeRegistry().get(name);
        }
      }),
      $.Method.new({
        name: 'serviceProxy',
        doc: 'create an RPC proxy for a service with retry support',
        async do(c) {
          const name = c.name;
          const timeout = c.timeout || 30;
          const retries = c.retries ?? 5;
          const retryDelayMs = c.retryDelayMs ?? 200;

          for (let attempt = 0; attempt <= retries; attempt++) {
            const node = this.nodeRegistry().get(name);
            if (node && node.connected()) {
              return node.serviceProxy({ name, timeout });
            }
            if (attempt < retries) {
              const delay = retryDelayMs * Math.pow(2, attempt);
              await __.sleep(delay);
            }
          }
          throw new Error(`service ${name} not connected after ${retries + 1} attempts`);
        }
      }),
      $.Method.new({
        name: 'waitForService',
        doc: 'wait for a specific service to connect',
        async do(c) {
          const name = c.name;
          const timeoutMs = c.timeoutMs ?? 10000;
          const pollMs = c.pollMs ?? 100;
          const startTime = Date.now();

          while (Date.now() - startTime < timeoutMs) {
            const node = this.nodeRegistry().get(name);
            if (node && node.connected()) {
              return true;
            }
            await __.sleep(pollMs);
          }
          throw new Error(`service ${name} did not connect within ${timeoutMs}ms`);
        }
      }),
      $.Method.new({
        name: 'waitForAllServices',
        doc: 'wait for all registered services to connect',
        async do(c = {}) {
          const timeoutMs = c.timeoutMs ?? 30000;
          const pollMs = c.pollMs ?? 100;
          const startTime = Date.now();
          const serviceNames = this.specs().map(s => s.serviceName());

          while (Date.now() - startTime < timeoutMs) {
            const allConnected = serviceNames.every(name => {
              const node = this.nodeRegistry().get(name);
              return node && node.connected();
            });
            if (allConnected) {
              return true;
            }
            await __.sleep(pollMs);
          }
          const disconnected = serviceNames.filter(name => {
            const node = this.nodeRegistry().get(name);
            return !node || !node.connected();
          });
          throw new Error(`services did not connect within ${timeoutMs}ms: ${disconnected.join(', ')}`);
        }
      }),
      $.Method.new({
        name: 'registerService',
        doc: 'register a service to be managed',
        do(spec) {
          this.specs().push(spec);
          return this;
        }
      }),
      $.Method.new({
        name: 'handleUiRpc',
        doc: 'handle RPC calls from web UI clients',
        async do(socket, request) {
          const { callId, service, method, args } = request;
          try {
            const proxy = await this.serviceProxy({ name: service, timeout: 30 });
            const result = await proxy[method](...(args || []));
            socket.send(JSON.stringify({ callId, result }));
          } catch (e) {
            this.tlog(`UI RPC error: ${service}.${method}`, e.message);
            socket.send(JSON.stringify({ callId, error: e.message }));
          }
        }
      }),
      $.Method.new({
        name: 'serve',
        doc: 'start the WebSocket server',
        do() {
          const self = this;
          this.running(true);
          Bun.serve({
            port: this.port(),
            fetch(req, server) {
              if (server.upgrade(req)) {
                return;
              }
              return new Response('Agenda Supervisor', { status: 200 });
            },
            websocket: {
              message(socket, messageStr) {
                const raw = JSON.parse(messageStr);
                // Handle UI RPC format (type: "rpc" with service/method/args)
                if (raw.type === 'rpc' && raw.service) {
                  self.handleUiRpc(socket, raw);
                  return;
                }
                const message = $live.LiveMessage.new(raw);
                if (message.to() !== 'master') {
                  return self.routeMessage(message, socket);
                }
                const handler = self.handlers()[message.topic()];
                if (handler) {
                  handler.handle({
                    master: self,
                    socket,
                    message
                  });
                } else {
                  self.tlog(`unknown handler for topic: ${message.topic()}`);
                }
              },
              close(socket) {
                const found = self.nodeRegistry().findBySocket(socket);
                if (found) {
                  const { name, node } = found;
                  self.tlog(`service disconnected: ${name}`);
                  node.connected(false);
                  const managed = self.services()[name];
                  if (managed) {
                    managed.markUnhealthy('disconnected');
                  }
                }
              }
            }
          });
          this.tlog(`supervisor listening on port ${this.port()}`);
        }
      }),
      $.Method.new({
        name: 'routeMessage',
        do(message, socket) {
          const msgTo = message.to?.() ?? message.to;
          const node = this.nodeRegistry().get(msgTo);
          if (!node || !node.connected()) {
            const sender = this.nodeRegistry().findBySocket(socket);
            this.tlog(`routing error: node not found or disconnected`, {
              to: message.to?.() ?? message.to,
              from: message.from?.() ?? message.from,
              topic: message.topic?.() ?? message.topic,
              mid: message.mid?.() ?? message.mid,
              sender: sender?.name || 'unknown',
              registeredNodes: Object.keys(this.nodeRegistry().nodes()),
            });
            const msgFrom = message.from?.() ?? message.from;
            const fromNode = this.nodeRegistry().get(msgFrom);
            if (fromNode && fromNode.connected()) {
              fromNode.send($live.LiveMessage.new({
                topic: 'error',
                to: msgFrom,
                from: 'master',
                data: {
                  mid: message.mid?.() ?? message.mid,
                  value: `unknown node ${message.to?.() ?? message.to}`
                }
              }));
            }
          } else {
            // Check if this is a response/error for a pending local request
            // (e.g., from supervisor's health checks via serviceProxy)
            const topic = message.topic();
            if ((topic === 'response' || topic === 'error') && node.checkResponse) {
              const mid = message.data()?.mid;
              if (mid && node.checkResponse(mid)) {
                // Handle locally - this response is for a request the supervisor made
                node.handle(node.socket(), message);
                return;
              }
            }
            node.send(message);
          }
        }
      }),
      $.Method.new({
        name: 'startAll',
        doc: 'start all registered services',
        async do() {
          for (const spec of this.specs()) {
            const managed = _.ManagedService.new({
              spec,
              supervisor: this,
            });
            this.services()[spec.serviceName()] = managed;
            await managed.start();
            await __.sleep(100);
          }
        }
      }),
      $.Method.new({
        name: 'stopAll',
        doc: 'stop all managed services',
        do() {
          for (const managed of Object.values(this.services())) {
            managed.stop();
          }
          this.running(false);
        }
      }),
      $.Method.new({
        name: 'waitForExit',
        doc: 'wait for all processes to exit',
        async do(timeoutMs = 5000) {
          const startTime = Date.now();
          while (Date.now() - startTime < timeoutMs) {
            const running = Object.values(this.services()).filter(m => {
              const proc = m.process();
              return proc && !proc.killed;
            });
            if (running.length === 0) {
              return true;
            }
            await __.sleep(100);
          }
          // Force kill any remaining processes
          for (const managed of Object.values(this.services())) {
            const proc = managed.process();
            if (proc && !proc.killed) {
              this.tlog(`force killing ${managed.spec().serviceName()}`);
              proc.kill(9); // SIGKILL
            }
          }
          return false;
        }
      }),
      $.Method.new({
        name: 'healthCheckLoop',
        doc: 'periodically check health of all services via RPC',
        async do() {
          while (this.running()) {
            await __.sleep(this.healthCheckIntervalMs());
            if (!this.running()) break;

            for (const [name, managed] of Object.entries(this.services())) {
              if (managed.stopped()) continue;

              const result = await this.healthChecker().check(managed);
              if (result.skipped) continue;

              if (result.healthy) {
                managed.markHealthy();
              } else {
                managed.markUnhealthy(result.reason);
              }
            }
          }
        }
      }),
      $.Method.new({
        name: 'status',
        doc: 'get status of all services',
        do() {
          const result = {};
          for (const [name, managed] of Object.entries(this.services())) {
            result[name] = {
              healthy: managed.healthy(),
              healthState: managed.healthState(),
              consecutiveFailures: managed.consecutiveFailures(),
              restartCount: managed.restartCount(),
              lastStart: managed.lastStart()?.toISOString(),
              lastHealthCheck: managed.lastHealthCheck()?.toISOString(),
            };
          }
          return result;
        }
      }),
    ]
  });
}.module({
  name: 'supervisor',
  imports: [base, live],
}).load();
