import { __, base } from 'simulabra';
import live from 'simulabra/live';

export default await async function (_, $, $live) {
  $.Class.new({
    name: 'AgendaService',
    doc: 'Agenda service mixin - uses AGENDA_SERVICE_NAME env for backward compatibility',
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
    name: 'AgendaManagedService',
    doc: 'Agenda-specific ManagedService that uses AGENDA_SERVICE_NAME env',
    slots: [
      $live.ManagedService,
      $.Override.new({
        name: 'start',
        async do() {
          if (this.stopped()) {
            return;
          }
          const cmd = this.spec().command();
          const serviceName = this.spec().serviceName();
          this.tlog(`starting service ${serviceName}:`, cmd.join(' '));
          this.lastStart(new Date());

          const { join } = await import('path');
          const logsDir = this.supervisor()?.logsDir() || 'logs';
          const logPath = join(logsDir, `${serviceName}.log`);
          this.logFile(logPath);

          const self = this;
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
    ]
  });

  $.Class.new({
    name: 'AgendaSupervisor',
    doc: 'Agenda-specific Supervisor that uses AgendaManagedService',
    slots: [
      $live.Supervisor,
      $.Override.new({
        name: 'startAll',
        doc: 'start all registered services using AgendaManagedService',
        async do() {
          for (const spec of this.specs()) {
            const managed = _.AgendaManagedService.new({
              spec,
              supervisor: this,
            });
            this.services()[spec.serviceName()] = managed;
            await managed.start();
            await __.sleep(100);
          }
        }
      }),
    ]
  });
}.module({
  name: 'supervisor',
  imports: [base, live],
  exports: [
    '$live.EnvService',
    '$live.ServiceSpec',
    '$live.NodeRegistry',
    '$live.HealthCheck',
    '$live.ManagedService',
    '$live.HandshakeHandler',
    '$live.Supervisor',
  ],
}).load();
