import { __, base } from '../src/base.js';
import test from '../src/test.js';
import tools from '../src/tools.js';

export default await async function (_, $, $test, $tools) {
  $.Class.new({
    name: 'EchoTool',
    doc: 'Test tool that echoes its input',
    slots: [
      $tools.Tool,
      $.Var.new({ name: 'toolName', default: 'echo' }),
      $.Var.new({ name: 'doc', default: 'Echoes the input message back' }),
      $.Var.new({
        name: 'inputSchema',
        default: () => ({
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Message to echo' }
          },
          required: ['message']
        }),
      }),
      $.Method.new({
        name: 'execute',
        async do(args) {
          return { echoed: args.message };
        }
      }),
    ]
  });

  $.Class.new({
    name: 'AddTool',
    doc: 'Test tool that adds two numbers',
    slots: [
      $tools.Tool,
      $.Var.new({ name: 'toolName', default: 'add' }),
      $.Var.new({ name: 'doc', default: 'Adds two numbers together' }),
      $.Var.new({
        name: 'inputSchema',
        default: () => ({
          type: 'object',
          properties: {
            a: { type: 'number', description: 'First number' },
            b: { type: 'number', description: 'Second number' }
          },
          required: ['a', 'b']
        }),
      }),
      $.Method.new({
        name: 'execute',
        async do(args) {
          return { sum: args.a + args.b };
        }
      }),
    ]
  });

  $.Class.new({
    name: 'FailingTool',
    doc: 'Test tool that always throws',
    slots: [
      $tools.Tool,
      $.Var.new({ name: 'toolName', default: 'fail' }),
      $.Var.new({ name: 'doc', default: 'Always fails' }),
      $.Var.new({
        name: 'inputSchema',
        default: () => ({ type: 'object', properties: {} }),
      }),
      $.Method.new({
        name: 'execute',
        async do() {
          throw new Error('Intentional failure');
        }
      }),
    ]
  });

  $.Class.new({
    name: 'ServiceTool',
    doc: 'Test tool that uses services context',
    slots: [
      $tools.Tool,
      $.Var.new({ name: 'toolName', default: 'greet' }),
      $.Var.new({ name: 'doc', default: 'Greets using a service' }),
      $.Var.new({
        name: 'inputSchema',
        default: () => ({
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name to greet' }
          },
          required: ['name']
        }),
      }),
      $.Method.new({
        name: 'execute',
        async do(args, services) {
          return { greeting: services.greeter.greet(args.name) };
        }
      }),
    ]
  });

  $test.Case.new({
    name: 'ToolDefinition',
    doc: 'Tool.definition() returns properly formatted tool definition',
    do() {
      const tool = _.EchoTool.new();
      const def = tool.definition();

      this.assertEq(def.name, 'echo');
      this.assertEq(def.description, 'Echoes the input message back');
      this.assertEq(def.input_schema.type, 'object');
      this.assert(def.input_schema.properties.message !== undefined, 'has message property');
      this.assertEq(def.input_schema.required[0], 'message');
    }
  });

  $test.Case.new({
    name: 'ToolRegistryRegister',
    doc: 'ToolRegistry.register() adds tools and invalidates cache',
    do() {
      const registry = $tools.ToolRegistry.new();
      registry.register(_.EchoTool.new());
      registry.register(_.AddTool.new());

      this.assertEq(registry.tools().length, 2);
    }
  });

  $test.Case.new({
    name: 'ToolRegistryGet',
    doc: 'ToolRegistry.get() retrieves tool by name',
    do() {
      const registry = $tools.ToolRegistry.new();
      registry.register(_.EchoTool.new());
      registry.register(_.AddTool.new());

      const echo = registry.get('echo');
      const add = registry.get('add');
      const missing = registry.get('nonexistent');

      this.assert(echo !== undefined, 'found echo tool');
      this.assertEq(echo.toolName(), 'echo');
      this.assert(add !== undefined, 'found add tool');
      this.assertEq(add.toolName(), 'add');
      this.assert(missing === undefined, 'missing tool returns undefined');
    }
  });

  $test.Case.new({
    name: 'ToolRegistryDefinitions',
    doc: 'ToolRegistry.definitions() returns all tool definitions',
    do() {
      const registry = $tools.ToolRegistry.new();
      registry.register(_.EchoTool.new());
      registry.register(_.AddTool.new());

      const defs = registry.definitions();

      this.assertEq(defs.length, 2);
      const names = defs.map(d => d.name).sort();
      this.assertEq(names[0], 'add');
      this.assertEq(names[1], 'echo');
    }
  });

  $test.AsyncCase.new({
    name: 'ToolRegistryExecuteSuccess',
    doc: 'ToolRegistry.execute() successfully runs a tool',
    async do() {
      const registry = $tools.ToolRegistry.new();
      registry.register(_.AddTool.new());

      const result = await registry.execute('add', { a: 5, b: 3 });

      this.assert(result.success, 'execution succeeded');
      this.assertEq(result.data.sum, 8);
    }
  });

  $test.AsyncCase.new({
    name: 'ToolRegistryExecuteUnknown',
    doc: 'ToolRegistry.execute() returns error for unknown tool',
    async do() {
      const registry = $tools.ToolRegistry.new();

      const result = await registry.execute('nonexistent', {});

      this.assert(!result.success, 'execution failed');
      this.assert(result.error.includes('Unknown tool'), 'error mentions unknown tool');
    }
  });

  $test.AsyncCase.new({
    name: 'ToolRegistryExecuteError',
    doc: 'ToolRegistry.execute() catches and returns tool errors',
    async do() {
      const registry = $tools.ToolRegistry.new();
      registry.register(_.FailingTool.new());

      const result = await registry.execute('fail', {});

      this.assert(!result.success, 'execution failed');
      this.assert(result.error.includes('Intentional failure'), 'error message preserved');
    }
  });

  $test.AsyncCase.new({
    name: 'ToolRegistryExecuteWithServices',
    doc: 'ToolRegistry.execute() passes services context to tool',
    async do() {
      const registry = $tools.ToolRegistry.new();
      registry.register(_.ServiceTool.new());

      const services = {
        greeter: {
          greet(name) { return `Hello, ${name}!`; }
        }
      };

      const result = await registry.execute('greet', { name: 'World' }, services);

      this.assert(result.success, 'execution succeeded');
      this.assertEq(result.data.greeting, 'Hello, World!');
    }
  });

  $test.Case.new({
    name: 'ToolRegistryMapCacheInvalidation',
    doc: 'ToolRegistry invalidates toolMap cache when tools are registered',
    do() {
      const registry = $tools.ToolRegistry.new();
      registry.register(_.EchoTool.new());

      const echo = registry.get('echo');
      this.assert(echo !== undefined, 'echo found after first registration');

      registry.register(_.AddTool.new());

      const add = registry.get('add');
      this.assert(add !== undefined, 'add found after second registration');
    }
  });

  $test.Case.new({
    name: 'ToolRegistryChaining',
    doc: 'ToolRegistry.register() returns this for chaining',
    do() {
      const registry = $tools.ToolRegistry.new()
        .register(_.EchoTool.new())
        .register(_.AddTool.new());

      this.assertEq(registry.tools().length, 2);
    }
  });
}.module({
  name: 'test.tools',
  imports: [base, test, tools],
}).load();
