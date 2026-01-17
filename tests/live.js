import { __, base } from '../src/base.js';
import test from '../src/test.js';
import live from '../src/live.js';

export default await async function (_, $, $test, $live) {
  $test.Case.new({
    name: 'ServiceSpecDefaults',
    doc: 'ServiceSpec should have sensible defaults',
    do() {
      const spec = $live.ServiceSpec.new({
        serviceName: 'TestService',
        command: ['echo', 'hello'],
      });
      this.assertEq(spec.serviceName(), 'TestService');
      this.assertEq(spec.command().length, 2);
      this.assertEq(spec.restartPolicy(), 'on_failure');
      this.assertEq(spec.maxRestarts(), 10);
      this.assertEq(spec.healthCheckMethod(), 'health');
      this.assert(spec.healthCheckEnabled(), 'health check enabled by default');
    }
  });

  $test.Case.new({
    name: 'ServiceSpecRestartPolicy',
    doc: 'ServiceSpec should validate restart policy',
    do() {
      const spec = $live.ServiceSpec.new({
        serviceName: 'Test',
        command: ['true'],
        restartPolicy: 'always',
      });
      this.assertEq(spec.restartPolicy(), 'always');
    }
  });

  $test.Case.new({
    name: 'NodeRegistryOperations',
    doc: 'NodeRegistry should register, get, and unregister nodes',
    do() {
      const registry = $live.NodeRegistry.new();

      const mockNode = { socket: () => 'socket1', connected: () => true };
      registry.register('service1', mockNode);

      this.assertEq(registry.get('service1'), mockNode);
      this.assert(registry.isConnected('service1'), 'node should be connected');

      const entries = registry.all();
      this.assertEq(entries.length, 1);
      this.assertEq(entries[0][0], 'service1');

      registry.unregister('service1');
      this.assertEq(registry.get('service1'), undefined);
    }
  });

  $test.Case.new({
    name: 'NodeRegistryFindBySocket',
    doc: 'NodeRegistry should find nodes by socket',
    do() {
      const registry = $live.NodeRegistry.new();
      const socket1 = { id: 1 };
      const socket2 = { id: 2 };

      registry.register('svc1', { socket: () => socket1, connected: () => true });
      registry.register('svc2', { socket: () => socket2, connected: () => true });

      const found = registry.findBySocket(socket1);
      this.assertEq(found.name, 'svc1');

      const notFound = registry.findBySocket({ id: 999 });
      this.assertEq(notFound, null);
    }
  });

  $test.Case.new({
    name: 'ManagedServiceHealthStates',
    doc: 'ManagedService should track health state transitions',
    do() {
      const spec = $live.ServiceSpec.new({
        serviceName: 'TestService',
        command: ['true'],
      });
      const managed = $live.ManagedService.new({ spec });

      this.assert(!managed.healthy(), 'starts unhealthy');
      this.assertEq(managed.healthState(), 'unknown');
      this.assertEq(managed.consecutiveFailures(), 0);

      managed.markHealthy();
      this.assert(managed.healthy(), 'now healthy');
      this.assertEq(managed.healthState(), 'healthy');
      this.assertEq(managed.consecutiveFailures(), 0);

      managed.markUnhealthy('test failure');
      this.assert(!managed.healthy(), 'now unhealthy');
      this.assertEq(managed.healthState(), 'unhealthy');
      this.assertEq(managed.consecutiveFailures(), 1);

      managed.markUnhealthy('another failure');
      this.assertEq(managed.consecutiveFailures(), 2);
    }
  });

  $test.Case.new({
    name: 'ManagedServiceBackoff',
    doc: 'ManagedService should track and reset backoff',
    do() {
      const spec = $live.ServiceSpec.new({
        serviceName: 'TestService',
        command: ['true'],
      });
      const managed = $live.ManagedService.new({ spec });

      this.assertEq(managed.backoffMs(), 1000);
      this.assertEq(managed.restartCount(), 0);

      managed.backoffMs(4000);
      managed.restartCount(3);

      managed.resetBackoff();
      this.assertEq(managed.backoffMs(), 1000);
      this.assertEq(managed.restartCount(), 0);
    }
  });

  $test.Case.new({
    name: 'ManagedServiceRestartPolicy',
    doc: 'ManagedService should respect restart policy',
    do() {
      const neverSpec = $live.ServiceSpec.new({
        serviceName: 'Never',
        command: ['true'],
        restartPolicy: 'never',
      });
      const neverManaged = $live.ManagedService.new({ spec: neverSpec });
      this.assert(!neverManaged.shouldRestart(0), 'never: no restart on success');
      this.assert(!neverManaged.shouldRestart(1), 'never: no restart on failure');

      const alwaysSpec = $live.ServiceSpec.new({
        serviceName: 'Always',
        command: ['true'],
        restartPolicy: 'always',
      });
      const alwaysManaged = $live.ManagedService.new({ spec: alwaysSpec });
      this.assert(alwaysManaged.shouldRestart(0), 'always: restart on success');
      this.assert(alwaysManaged.shouldRestart(1), 'always: restart on failure');

      const onFailureSpec = $live.ServiceSpec.new({
        serviceName: 'OnFailure',
        command: ['true'],
        restartPolicy: 'on_failure',
      });
      const onFailureManaged = $live.ManagedService.new({ spec: onFailureSpec });
      this.assert(!onFailureManaged.shouldRestart(0), 'on_failure: no restart on success');
      this.assert(onFailureManaged.shouldRestart(1), 'on_failure: restart on failure');
    }
  });

  $test.Case.new({
    name: 'HealthCheckSkipped',
    doc: 'HealthCheck should skip when disabled in spec',
    async do() {
      const spec = $live.ServiceSpec.new({
        serviceName: 'Test',
        command: ['true'],
        healthCheckEnabled: false,
      });
      const managed = $live.ManagedService.new({ spec });
      managed.healthy(true);

      const mockSupervisor = {
        nodeRegistry: () => $live.NodeRegistry.new(),
      };
      const checker = $live.HealthCheck.new({ supervisor: mockSupervisor });

      const result = await checker.check(managed);
      this.assert(result.skipped, 'should be skipped');
      this.assert(result.healthy, 'should preserve existing health state');
    }
  });

  $test.Case.new({
    name: 'HealthCheckDisconnected',
    doc: 'HealthCheck should report unhealthy when disconnected',
    async do() {
      const spec = $live.ServiceSpec.new({
        serviceName: 'Test',
        command: ['true'],
      });
      const managed = $live.ManagedService.new({ spec });

      const registry = $live.NodeRegistry.new();
      const mockSupervisor = {
        nodeRegistry: () => registry,
      };
      const checker = $live.HealthCheck.new({ supervisor: mockSupervisor });

      const result = await checker.check(managed);
      this.assert(!result.healthy, 'should be unhealthy');
      this.assertEq(result.reason, 'disconnected');
    }
  });

  $test.Case.new({
    name: 'LiveMessageClone',
    doc: 'LiveMessage should support cloning',
    do() {
      const msg = $live.LiveMessage.new({
        topic: 'test',
        from: 'sender',
        to: 'receiver',
        data: { value: 42 },
      });

      this.assertEq(msg.topic(), 'test');
      this.assertEq(msg.from(), 'sender');
      this.assertEq(msg.to(), 'receiver');
      this.assertEq(msg.data().value, 42);
    }
  });

  $test.Case.new({
    name: 'ReifiedPromise',
    doc: 'ReifiedPromise should expose resolve and reject',
    async do() {
      const p1 = $live.ReifiedPromise.new();
      setTimeout(() => p1.resolve('success'), 10);
      const result = await p1.promise();
      this.assertEq(result, 'success');

      const p2 = $live.ReifiedPromise.new();
      setTimeout(() => p2.reject('failure'), 10);
      try {
        await p2.promise();
        this.assert(false, 'should have rejected');
      } catch (e) {
        this.assertEq(e, 'failure');
      }
    }
  });

  $test.Case.new({
    name: 'MessageDispatcher',
    doc: 'MessageDispatcher should route to handlers',
    do() {
      let handled = null;

      const handler = {
        topic: () => 'test',
        handle: (ctx) => { handled = ctx; },
      };

      const dispatcher = $live.MessageDispatcher.new();
      dispatcher.registerHandler(handler);

      const message = $live.LiveMessage.new({ topic: 'test', data: { x: 1 } });
      dispatcher.handle('socket', message);

      this.assertEq(handled.message.topic(), 'test');
      this.assertEq(handled.socket, 'socket');
    }
  });
}.module({
  name: 'test.live',
  imports: [base, test, live],
}).load();
