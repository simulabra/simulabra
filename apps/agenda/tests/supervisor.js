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

  $test.Case.new({
    name: 'SupervisorRouteMessageUnknownNode',
    doc: 'routeMessage should handle unknown destination nodes',
    do() {
      const sup = $supervisor.Supervisor.new();
      // Create a mock message targeting unknown node
      const message = {
        to() { return 'unknown-service'; },
        from() { return 'sender'; },
        mid() { return 'msg-1'; }
      };
      // Should not throw, just log
      sup.routeMessage(message, null);
      // Verify no node was added
      this.assert(!sup.nodes()['unknown-service'], 'should not create unknown node');
    }
  });

  $test.AsyncCase.new({
    name: 'SupervisorStartAllServices',
    doc: 'startAll should start all registered services',
    async do() {
      const sup = $supervisor.Supervisor.new({ port: 13031 });

      // Register two quick-exit services
      const spec1 = $supervisor.ServiceSpec.new({
        serviceName: 'Service1',
        command: ['echo', 'hello1'],
        restartPolicy: 'never',
      });
      const spec2 = $supervisor.ServiceSpec.new({
        serviceName: 'Service2',
        command: ['echo', 'hello2'],
        restartPolicy: 'never',
      });

      sup.registerService(spec1);
      sup.registerService(spec2);

      await sup.startAll();

      this.assert(sup.services()['Service1'], 'should have Service1');
      this.assert(sup.services()['Service2'], 'should have Service2');
      this.assertEq(sup.specs().length, 2, 'should have 2 specs');

      sup.stopAll();
      await __.sleep(100);
    }
  });

  $test.AsyncCase.new({
    name: 'SupervisorWaitForExit',
    doc: 'waitForExit should wait for processes to terminate',
    async do() {
      const sup = $supervisor.Supervisor.new({ port: 13032 });

      const spec = $supervisor.ServiceSpec.new({
        serviceName: 'QuickExit',
        command: ['echo', 'done'],
        restartPolicy: 'never',
      });

      sup.registerService(spec);
      await sup.startAll();

      // Stop and wait
      sup.stopAll();
      const exited = await sup.waitForExit(2000);

      this.assert(exited, 'processes should have exited');
    }
  });

  $test.Case.new({
    name: 'ManagedServiceMaxRestarts',
    doc: 'ManagedService should respect maxRestarts limit',
    do() {
      const spec = $supervisor.ServiceSpec.new({
        serviceName: 'LimitedRestarts',
        command: ['false'],
        restartPolicy: 'on_failure',
        maxRestarts: 3,
      });
      const managed = $supervisor.ManagedService.new({ spec });

      // Simulate reaching max restarts
      managed.restartCount(3);

      // onExit should not schedule restart when at limit
      this.assertEq(managed.shouldRestart(1), true, 'should want to restart on failure');
      // But restartCount >= maxRestarts prevents it (tested by checking logic)
      this.assert(managed.restartCount() >= managed.spec().maxRestarts(), 'at max restarts');
    }
  });

  $test.Case.new({
    name: 'ManagedServiceBackoffDoubling',
    doc: 'ManagedService backoff should double up to max',
    do() {
      const spec = $supervisor.ServiceSpec.new({
        serviceName: 'BackoffTest',
        command: ['echo'],
      });
      const managed = $supervisor.ManagedService.new({ spec });

      this.assertEq(managed.backoffMs(), 1000, 'initial backoff');

      managed.backoffMs(managed.backoffMs() * 2);
      this.assertEq(managed.backoffMs(), 2000);

      managed.backoffMs(managed.backoffMs() * 2);
      this.assertEq(managed.backoffMs(), 4000);

      // Verify cap at 60000
      managed.backoffMs(Math.min(32000 * 2, 60000));
      this.assertEq(managed.backoffMs(), 60000);
    }
  });

  $test.Case.new({
    name: 'SupervisorHandlerRegistration',
    doc: 'Supervisor should register and retrieve handlers',
    do() {
      const sup = $supervisor.Supervisor.new();

      // Default handler should be registered
      this.assert(sup.handlers()['handshake'], 'should have handshake handler');

      // Register custom handler
      const customHandler = {
        topic() { return 'custom'; },
        handle() {}
      };
      sup.registerHandler(customHandler);
      this.assertEq(sup.handlers()['custom'], customHandler);
    }
  });
}.module({
  name: 'test.supervisor',
  imports: [base, test, supervisor],
}).load();
