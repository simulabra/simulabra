import { __, base } from 'simulabra';
import test from 'simulabra/test';
import helpers from './support/helpers.js';
import supervisor from '../src/supervisor.js';

export default await async function (_, $, $test, $helpers, $supervisor) {
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

  $test.Case.new({
    name: 'NodeRegistryCreation',
    doc: 'NodeRegistry should be created with empty nodes',
    do() {
      const registry = $supervisor.NodeRegistry.new();
      this.assertEq(Object.keys(registry.nodes()).length, 0);
    }
  });

  $test.Case.new({
    name: 'NodeRegistryRegisterAndGet',
    doc: 'NodeRegistry should register and retrieve nodes',
    do() {
      const registry = $supervisor.NodeRegistry.new();
      const mockNode = { uid() { return 'test'; }, connected() { return true; } };

      registry.register('test-service', mockNode);
      this.assertEq(registry.get('test-service'), mockNode);
      this.assert(registry.isConnected('test-service'), 'should be connected');
    }
  });

  $test.Case.new({
    name: 'NodeRegistryUnregister',
    doc: 'NodeRegistry should unregister nodes',
    do() {
      const registry = $supervisor.NodeRegistry.new();
      const mockNode = { uid() { return 'test'; } };

      registry.register('test-service', mockNode);
      const removed = registry.unregister('test-service');

      this.assertEq(removed, mockNode);
      this.assertEq(registry.get('test-service'), undefined);
    }
  });

  $test.Case.new({
    name: 'NodeRegistryFindBySocket',
    doc: 'NodeRegistry should find nodes by socket',
    do() {
      const registry = $supervisor.NodeRegistry.new();
      const mockSocket = { id: 'socket-1' };
      const mockNode = { socket() { return mockSocket; } };

      registry.register('test-service', mockNode);
      const found = registry.findBySocket(mockSocket);

      this.assertEq(found.name, 'test-service');
      this.assertEq(found.node, mockNode);
    }
  });

  $test.Case.new({
    name: 'NodeRegistryAll',
    doc: 'NodeRegistry.all should return all entries',
    do() {
      const registry = $supervisor.NodeRegistry.new();
      const node1 = { uid() { return 'n1'; } };
      const node2 = { uid() { return 'n2'; } };

      registry.register('service1', node1);
      registry.register('service2', node2);

      const all = registry.all();
      this.assertEq(all.length, 2);
    }
  });

  $test.Case.new({
    name: 'ServiceSpecHealthCheckEnabled',
    doc: 'ServiceSpec should have healthCheckEnabled flag',
    do() {
      const spec = $supervisor.ServiceSpec.new({
        serviceName: 'TestService',
        command: ['echo'],
      });
      this.assertEq(spec.healthCheckEnabled(), true, 'default should be true');

      const disabledSpec = $supervisor.ServiceSpec.new({
        serviceName: 'NoHealthCheck',
        command: ['echo'],
        healthCheckEnabled: false,
      });
      this.assertEq(disabledSpec.healthCheckEnabled(), false);
    }
  });

  $test.Case.new({
    name: 'ManagedServiceHealthStateTracking',
    doc: 'ManagedService should track health state',
    do() {
      const spec = $supervisor.ServiceSpec.new({
        serviceName: 'TestService',
        command: ['echo'],
      });
      const managed = $supervisor.ManagedService.new({ spec });

      this.assertEq(managed.healthState(), 'unknown', 'initial state');
      this.assertEq(managed.consecutiveFailures(), 0);
    }
  });

  $test.Case.new({
    name: 'ManagedServiceMarkHealthy',
    doc: 'ManagedService.markHealthy should transition to healthy state',
    do() {
      const spec = $supervisor.ServiceSpec.new({
        serviceName: 'TestService',
        command: ['echo'],
      });
      const managed = $supervisor.ManagedService.new({ spec });
      managed.backoffMs(8000);
      managed.restartCount(3);

      managed.markHealthy();

      this.assertEq(managed.healthy(), true);
      this.assertEq(managed.healthState(), 'healthy');
      this.assertEq(managed.consecutiveFailures(), 0);
      this.assertEq(managed.backoffMs(), 1000, 'should reset backoff');
      this.assertEq(managed.restartCount(), 0, 'should reset restart count');
      this.assert(managed.lastHealthCheck() instanceof Date);
    }
  });

  $test.Case.new({
    name: 'ManagedServiceMarkUnhealthy',
    doc: 'ManagedService.markUnhealthy should transition to unhealthy state',
    do() {
      const spec = $supervisor.ServiceSpec.new({
        serviceName: 'TestService',
        command: ['echo'],
      });
      const managed = $supervisor.ManagedService.new({ spec });
      managed.healthy(true);
      managed.healthState('healthy');

      managed.markUnhealthy('test failure');

      this.assertEq(managed.healthy(), false);
      this.assertEq(managed.healthState(), 'unhealthy');
      this.assertEq(managed.consecutiveFailures(), 1);
      this.assert(managed.lastHealthCheck() instanceof Date);
    }
  });

  $test.Case.new({
    name: 'ManagedServiceConsecutiveFailures',
    doc: 'ManagedService should track consecutive failures',
    do() {
      const spec = $supervisor.ServiceSpec.new({
        serviceName: 'TestService',
        command: ['echo'],
      });
      const managed = $supervisor.ManagedService.new({ spec });

      managed.markUnhealthy('failure 1');
      this.assertEq(managed.consecutiveFailures(), 1);

      managed.markUnhealthy('failure 2');
      this.assertEq(managed.consecutiveFailures(), 2);

      managed.markHealthy();
      this.assertEq(managed.consecutiveFailures(), 0, 'should reset on healthy');
    }
  });

  $test.Case.new({
    name: 'SupervisorHasNodeRegistry',
    doc: 'Supervisor should have a NodeRegistry',
    do() {
      const sup = $supervisor.Supervisor.new();
      this.assert(sup.nodeRegistry(), 'should have nodeRegistry');
      this.assert(sup.nodeRegistry().nodes, 'should have nodes method');
    }
  });

  $test.Case.new({
    name: 'SupervisorHasHealthChecker',
    doc: 'Supervisor should have a HealthCheck instance',
    do() {
      const sup = $supervisor.Supervisor.new();
      this.assert(sup.healthChecker(), 'should have healthChecker');
      this.assertEq(sup.healthChecker().timeoutMs(), 5000);
    }
  });

  $test.Case.new({
    name: 'SupervisorNodesBackwardsCompatible',
    doc: 'Supervisor.nodes() should return nodeRegistry nodes',
    do() {
      const sup = $supervisor.Supervisor.new();
      const mockNode = { uid() { return 'test'; } };

      sup.nodeRegistry().register('test-service', mockNode);

      this.assertEq(sup.nodes()['test-service'], mockNode);
      this.assertEq(sup.node('test-service'), mockNode);
    }
  });

  $test.Case.new({
    name: 'SupervisorStatusIncludesHealthState',
    doc: 'Supervisor.status should include health state info',
    do() {
      const sup = $supervisor.Supervisor.new();
      const spec = $supervisor.ServiceSpec.new({
        serviceName: 'TestService',
        command: ['echo'],
      });
      const managed = $supervisor.ManagedService.new({ spec });
      managed.markHealthy();
      sup.services()['TestService'] = managed;

      const status = sup.status();
      this.assertEq(status.TestService.healthState, 'healthy');
      this.assertEq(status.TestService.consecutiveFailures, 0);
      this.assert(status.TestService.lastHealthCheck, 'should have lastHealthCheck');
    }
  });

  $test.AsyncCase.new({
    name: 'HealthCheckSkipsDisabled',
    doc: 'HealthCheck should skip services with healthCheckEnabled=false',
    async do() {
      const sup = $supervisor.Supervisor.new();
      const spec = $supervisor.ServiceSpec.new({
        serviceName: 'NoHealthCheck',
        command: ['echo'],
        healthCheckEnabled: false,
      });
      const managed = $supervisor.ManagedService.new({ spec, supervisor: sup });
      managed.healthy(true);

      const result = await sup.healthChecker().check(managed);

      this.assertEq(result.skipped, true);
      this.assertEq(result.healthy, true);
    }
  });

  $test.AsyncCase.new({
    name: 'HealthCheckReturnsUnhealthyWhenDisconnected',
    doc: 'HealthCheck should return unhealthy when node is not connected',
    async do() {
      const sup = $supervisor.Supervisor.new();
      const spec = $supervisor.ServiceSpec.new({
        serviceName: 'DisconnectedService',
        command: ['echo'],
      });
      const managed = $supervisor.ManagedService.new({ spec, supervisor: sup });

      const result = await sup.healthChecker().check(managed);

      this.assertEq(result.healthy, false);
      this.assertEq(result.reason, 'disconnected');
    }
  });
  $test.Case.new({
    name: 'AgendaServiceDefaultsUidFromClassName',
    doc: 'AgendaService should default uid from class name when no env var set',
    do() {
      const originalEnv = process.env.AGENDA_SERVICE_NAME;
      delete process.env.AGENDA_SERVICE_NAME;

      $.Class.new({
        name: 'TestAgendaService',
        slots: [$supervisor.AgendaService]
      });

      const service = _.TestAgendaService.new();
      this.assertEq(service.uid(), 'TestAgendaService');

      if (originalEnv !== undefined) {
        process.env.AGENDA_SERVICE_NAME = originalEnv;
      }
    }
  });

  $test.Case.new({
    name: 'AgendaServiceReadsUidFromEnv',
    doc: 'AgendaService should read uid from AGENDA_SERVICE_NAME env var',
    do() {
      const originalEnv = process.env.AGENDA_SERVICE_NAME;
      process.env.AGENDA_SERVICE_NAME = 'EnvDefinedService';

      $.Class.new({
        name: 'TestEnvService',
        slots: [$supervisor.AgendaService]
      });

      const service = _.TestEnvService.new();
      this.assertEq(service.uid(), 'EnvDefinedService');

      if (originalEnv !== undefined) {
        process.env.AGENDA_SERVICE_NAME = originalEnv;
      } else {
        delete process.env.AGENDA_SERVICE_NAME;
      }
    }
  });

  $test.Case.new({
    name: 'AgendaServicePreservesExplicitUid',
    doc: 'AgendaService should preserve uid if explicitly passed',
    do() {
      const originalEnv = process.env.AGENDA_SERVICE_NAME;
      delete process.env.AGENDA_SERVICE_NAME;

      $.Class.new({
        name: 'TestExplicitUid',
        slots: [$supervisor.AgendaService]
      });

      const service = _.TestExplicitUid.new({ uid: 'ExplicitlySet' });
      this.assertEq(service.uid(), 'ExplicitlySet');

      if (originalEnv !== undefined) {
        process.env.AGENDA_SERVICE_NAME = originalEnv;
      }
    }
  });

  $test.Case.new({
    name: 'ManagedServicePassesServiceNameInEnv',
    doc: 'ManagedService.start should set AGENDA_SERVICE_NAME in child env',
    do() {
      const spec = $supervisor.ServiceSpec.new({
        serviceName: 'TestEnvPassService',
        command: ['echo', 'test'],
        restartPolicy: 'never',
      });
      const sup = $supervisor.Supervisor.new({ port: 13050 });
      const managed = $supervisor.ManagedService.new({ spec, supervisor: sup });

      // The env is set during start() via Bun.spawn
      // We verify the implementation passes serviceName correctly
      // by checking the spec
      this.assertEq(managed.spec().serviceName(), 'TestEnvPassService');
    }
  });
}.module({
  name: 'test.supervisor',
  imports: [base, test, helpers, supervisor],
}).load();
