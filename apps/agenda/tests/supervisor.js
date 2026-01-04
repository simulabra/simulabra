import { __, base } from 'simulabra';
import test from 'simulabra/test';
import supervisor from '../src/supervisor.js';

export default await async function (_, $, $test, $supervisor) {
  $test.Case.new({
    name: 'ServiceSpecCreation',
    doc: 'ServiceSpec should be created with required fields',
    do() {
      const spec = $supervisor.ServiceSpec.new({
        serviceName: 'TestService',
        command: ['echo', 'hello'],
      });
      this.assertEq(spec.serviceName(), 'TestService');
      this.assertEq(spec.command()[0], 'echo');
      this.assertEq(spec.restartPolicy(), 'on_failure');
      this.assertEq(spec.maxRestarts(), 10);
    }
  });

  $test.Case.new({
    name: 'ServiceSpecWithOptions',
    doc: 'ServiceSpec should accept custom options',
    do() {
      const spec = $supervisor.ServiceSpec.new({
        serviceName: 'CustomService',
        command: ['node', 'service.js'],
        restartPolicy: 'always',
        maxRestarts: 5,
        healthCheckMethod: 'ping',
      });
      this.assertEq(spec.restartPolicy(), 'always');
      this.assertEq(spec.maxRestarts(), 5);
      this.assertEq(spec.healthCheckMethod(), 'ping');
    }
  });

  $test.Case.new({
    name: 'ManagedServiceCreation',
    doc: 'ManagedService should be created with a spec',
    do() {
      const spec = $supervisor.ServiceSpec.new({
        serviceName: 'TestService',
        command: ['echo', 'test'],
      });
      const managed = $supervisor.ManagedService.new({ spec });
      this.assertEq(managed.spec().serviceName(), 'TestService');
      this.assertEq(managed.restartCount(), 0);
      this.assertEq(managed.backoffMs(), 1000);
      this.assertEq(managed.healthy(), false);
    }
  });

  $test.Case.new({
    name: 'ManagedServiceShouldRestart',
    doc: 'ManagedService should determine if restart is needed',
    do() {
      const neverSpec = $supervisor.ServiceSpec.new({
        serviceName: 'NeverRestart',
        command: ['echo'],
        restartPolicy: 'never',
      });
      const neverManaged = $supervisor.ManagedService.new({ spec: neverSpec });
      this.assertEq(neverManaged.shouldRestart(0), false);
      this.assertEq(neverManaged.shouldRestart(1), false);

      const alwaysSpec = $supervisor.ServiceSpec.new({
        serviceName: 'AlwaysRestart',
        command: ['echo'],
        restartPolicy: 'always',
      });
      const alwaysManaged = $supervisor.ManagedService.new({ spec: alwaysSpec });
      this.assertEq(alwaysManaged.shouldRestart(0), true);
      this.assertEq(alwaysManaged.shouldRestart(1), true);

      const onFailureSpec = $supervisor.ServiceSpec.new({
        serviceName: 'OnFailureRestart',
        command: ['echo'],
        restartPolicy: 'on_failure',
      });
      const onFailureManaged = $supervisor.ManagedService.new({ spec: onFailureSpec });
      this.assertEq(onFailureManaged.shouldRestart(0), false);
      this.assertEq(onFailureManaged.shouldRestart(1), true);
    }
  });

  $test.Case.new({
    name: 'ManagedServiceBackoffReset',
    doc: 'ManagedService should reset backoff on success',
    do() {
      const spec = $supervisor.ServiceSpec.new({
        serviceName: 'TestService',
        command: ['echo'],
      });
      const managed = $supervisor.ManagedService.new({ spec });
      managed.backoffMs(8000);
      managed.restartCount(3);

      managed.resetBackoff();

      this.assertEq(managed.backoffMs(), 1000);
      this.assertEq(managed.restartCount(), 0);
    }
  });

  $test.Case.new({
    name: 'SupervisorCreation',
    doc: 'Supervisor should be created with defaults',
    do() {
      const sup = $supervisor.Supervisor.new();
      this.assertEq(sup.port(), 3030);
      this.assertEq(sup.healthCheckIntervalMs(), 10000);
      this.assert(sup.specs().length === 0, 'should have empty specs');
    }
  });

  $test.Case.new({
    name: 'SupervisorRegisterService',
    doc: 'Supervisor should register services',
    do() {
      const sup = $supervisor.Supervisor.new();
      const spec = $supervisor.ServiceSpec.new({
        serviceName: 'TestService',
        command: ['echo'],
      });

      sup.registerService(spec);

      this.assertEq(sup.specs().length, 1);
      this.assertEq(sup.specs()[0].serviceName(), 'TestService');
    }
  });

  $test.Case.new({
    name: 'SupervisorStatus',
    doc: 'Supervisor should report service status',
    do() {
      const sup = $supervisor.Supervisor.new();
      const spec = $supervisor.ServiceSpec.new({
        serviceName: 'TestService',
        command: ['echo'],
      });

      const managed = $supervisor.ManagedService.new({ spec });
      managed.healthy(true);
      managed.lastStart(new Date());
      sup.services()['TestService'] = managed;

      const status = sup.status();
      this.assert(status.TestService, 'should have TestService status');
      this.assertEq(status.TestService.healthy, true);
      this.assertEq(status.TestService.restartCount, 0);
    }
  });

  $test.AsyncCase.new({
    name: 'ManagedServiceStartStop',
    doc: 'ManagedService should start and stop processes',
    async do() {
      const spec = $supervisor.ServiceSpec.new({
        serviceName: 'QuickProcess',
        command: ['sleep', '10'],
        restartPolicy: 'never',
      });
      const managed = $supervisor.ManagedService.new({ spec });

      await managed.start();
      this.assert(managed.process(), 'should have process');
      this.assert(managed.lastStart() instanceof Date, 'should have lastStart');

      managed.stop();
      this.assertEq(managed.stopped(), true);

      await __.sleep(100);
    }
  });

  $test.AsyncCase.new({
    name: 'SupervisorServeAndStop',
    doc: 'Supervisor should start and stop the WebSocket server',
    async do() {
      const sup = $supervisor.Supervisor.new({ port: 13030 });

      sup.serve();
      this.assertEq(sup.running(), true);

      await __.sleep(100);

      sup.stopAll();
      this.assertEq(sup.running(), false);
    }
  });
}.module({
  name: 'test.supervisor',
  imports: [base, test, supervisor],
}).load();
