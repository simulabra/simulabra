import { __, base } from 'simulabra';
import live from 'simulabra/live';
import { appendFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export default await async function (_, $, $live) {
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
          this.healthy(false);
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
          node.registerHandler($live.ResponseHandler.new());
          node.registerHandler($live.ErrorHandler.new());
          master.nodes()[from] = node;

          const managed = master.services()[from];
          if (managed) {
            managed.healthy(true);
            managed.resetBackoff();
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
      $.Var.new({ name: 'nodes' }),
      $.Var.new({ name: 'handlers' }),
      $.Var.new({ name: 'services' }),
      $.Var.new({ name: 'specs', default: () => [] }),
      $.Var.new({ name: 'healthCheckIntervalMs', default: 10000 }),
      $.Var.new({ name: 'healthCheckTimeoutMs', default: 5000 }),
      $.Var.new({ name: 'running', default: false }),
      $.After.new({
        name: 'init',
        do() {
          this.nodes({});
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
        name: 'writeLog',
        doc: 'write a line to the supervisor log',
        do(message) {
          const line = `[${new Date().toISOString()}] [supervisor] ${message}\n`;
          appendFileSync(this.logFile(), line);
        }
      }),
      $.Method.new({
        name: 'registerHandler',
        do(handler) {
          this.handlers()[handler.topic()] = handler;
        }
      }),
      $.Method.new({
        name: 'node',
        do(name) {
          return this.nodes()[name];
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
                const message = $live.LiveMessage.new(JSON.parse(messageStr));
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
                for (const [name, node] of Object.entries(self.nodes())) {
                  if (node.socket() === socket) {
                    self.tlog(`service disconnected: ${name}`);
                    node.connected(false);
                    const managed = self.services()[name];
                    if (managed) {
                      managed.healthy(false);
                    }
                    break;
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
          const node = this.nodes()[message.to()];
          if (!node || !node.connected()) {
            this.tlog(`node not found or disconnected: ${message.to()}`);
            const fromNode = this.nodes()[message.from()];
            if (fromNode && fromNode.connected()) {
              fromNode.send($live.LiveMessage.new({
                topic: 'error',
                to: message.from(),
                from: 'master',
                data: {
                  mid: message.mid(),
                  value: `unknown node ${message.to()}`
                }
              }));
            }
          } else {
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
        doc: 'periodically check health of all services via connection status',
        async do() {
          while (this.running()) {
            await __.sleep(this.healthCheckIntervalMs());
            if (!this.running()) break;

            for (const [name, managed] of Object.entries(this.services())) {
              const node = this.nodes()[name];
              const wasHealthy = managed.healthy();

              if (!node || !node.connected()) {
                if (wasHealthy) {
                  this.tlog(`${name} disconnected`);
                }
                managed.healthy(false);
              } else {
                if (!wasHealthy) {
                  this.tlog(`${name} reconnected`);
                  managed.resetBackoff();
                }
                managed.healthy(true);
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
              restartCount: managed.restartCount(),
              lastStart: managed.lastStart()?.toISOString(),
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
