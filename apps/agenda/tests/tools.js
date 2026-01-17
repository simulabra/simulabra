import { __, base } from 'simulabra';
import test from 'simulabra/test';
import coreTools from 'simulabra/tools';
import tools from '../src/tools.js';

export default await async function (_, $, $test, $coreTools, $tools) {
  $test.Case.new({
    name: 'ToolBaseClass',
    doc: 'Tool should have required slots and generate proper definition',
    do() {
      const tool = $tools.CreateLogTool.new();
      this.assertEq(tool.toolName(), 'create_log', 'should have toolName');
      this.assert(tool.doc(), 'should have doc');
      this.assert(tool.inputSchema(), 'should have input schema');

      const def = tool.definition();
      this.assertEq(def.name, 'create_log', 'definition should include name');
      this.assert(def.description, 'definition should include description');
      this.assert(def.input_schema, 'definition should include input_schema');
    }
  });

  $test.Case.new({
    name: 'ToolRegistryRegister',
    doc: 'ToolRegistry should register and lookup tools',
    do() {
      const registry = $coreTools.ToolRegistry.new();
      const tool = $tools.CreateLogTool.new();

      registry.register(tool);

      this.assertEq(registry.tools().length, 1, 'should have one tool');
      this.assertEq(registry.get('create_log'), tool, 'should find tool by name');
      this.assertEq(registry.get('nonexistent'), undefined, 'should return undefined for missing');
    }
  });

  $test.Case.new({
    name: 'ToolRegistryDefinitions',
    doc: 'ToolRegistry should return all tool definitions',
    do() {
      const registry = $coreTools.ToolRegistry.new();
      registry.register($tools.CreateLogTool.new());
      registry.register($tools.CreateTaskTool.new());

      const defs = registry.definitions();

      this.assertEq(defs.length, 2, 'should have two definitions');
      this.assertEq(defs[0].name, 'create_log');
      this.assertEq(defs[1].name, 'create_task');
    }
  });

  $test.Case.new({
    name: 'AgendaToolRegistryDefaults',
    doc: 'AgendaToolRegistry should come pre-configured with all tools',
    do() {
      const registry = $tools.AgendaToolRegistry.new();

      this.assertEq(registry.tools().length, 9, 'should have 9 tools');

      const toolNames = registry.tools().map(t => t.toolName());
      this.assert(toolNames.includes('create_log'), 'should have create_log');
      this.assert(toolNames.includes('create_task'), 'should have create_task');
      this.assert(toolNames.includes('complete_task'), 'should have complete_task');
      this.assert(toolNames.includes('create_reminder'), 'should have create_reminder');
      this.assert(toolNames.includes('search'), 'should have search');
      this.assert(toolNames.includes('list_tasks'), 'should have list_tasks');
      this.assert(toolNames.includes('list_logs'), 'should have list_logs');
      this.assert(toolNames.includes('list_reminders'), 'should have list_reminders');
      this.assert(toolNames.includes('trigger_webhook'), 'should have trigger_webhook');
    }
  });

  $test.Case.new({
    name: 'ToolInputSchemas',
    doc: 'Each tool should have proper input schema with required fields',
    do() {
      const registry = $tools.AgendaToolRegistry.new();

      const createLog = registry.get('create_log');
      this.assert(createLog.inputSchema().properties.content, 'create_log should have content property');
      this.assert(createLog.inputSchema().required.includes('content'), 'content should be required');

      const createTask = registry.get('create_task');
      this.assert(createTask.inputSchema().properties.title, 'create_task should have title property');
      this.assert(createTask.inputSchema().properties.priority, 'create_task should have priority property');

      const createReminder = registry.get('create_reminder');
      this.assert(createReminder.inputSchema().properties.message, 'create_reminder should have message');
      this.assert(createReminder.inputSchema().properties.when, 'create_reminder should have when');
      this.assert(createReminder.inputSchema().properties.recurrence, 'create_reminder should have recurrence');
    }
  });

  $test.AsyncCase.new({
    name: 'ToolRegistryExecuteUnknown',
    doc: 'ToolRegistry should handle unknown tool gracefully',
    async do() {
      const registry = $tools.AgendaToolRegistry.new();
      const result = await registry.execute('unknown_tool', {}, {});

      this.assertEq(result.success, false, 'should fail');
      this.assert(result.error.includes('Unknown tool'), 'should include error message');
    }
  });

  $test.AsyncCase.new({
    name: 'ToolRegistryExecuteWithMockedServices',
    doc: 'ToolRegistry should execute tool with services context',
    async do() {
      const registry = $tools.AgendaToolRegistry.new();

      let calledWith = null;
      const mockServices = {
        db: {
          createLog: (content, tags) => {
            calledWith = { content, tags };
            return { id: 'test-id', content, tags };
          }
        }
      };

      const result = await registry.execute('create_log', { content: 'test content', tags: ['tag1'] }, mockServices);

      this.assert(result.success, 'should succeed');
      this.assertEq(calledWith.content, 'test content', 'should pass content to db');
      this.assertEq(calledWith.tags.length, 1, 'should pass tags to db');
    }
  });

  $test.AsyncCase.new({
    name: 'ToolRegistryExecuteHandlesErrors',
    doc: 'ToolRegistry should wrap tool errors in result object',
    async do() {
      const registry = $tools.AgendaToolRegistry.new();

      const mockServices = {
        db: {
          createLog: () => {
            throw new Error('Database connection failed');
          }
        }
      };

      const result = await registry.execute('create_log', { content: 'test' }, mockServices);

      this.assertEq(result.success, false, 'should fail');
      this.assert(result.error.includes('Database connection failed'), 'should include error message');
    }
  });

  $test.Case.new({
    name: 'ToolDefinitionsMatchAnthropicFormat',
    doc: 'Tool definitions should match Anthropic API format',
    do() {
      const registry = $tools.AgendaToolRegistry.new();
      const defs = registry.definitions();

      for (const def of defs) {
        this.assert(typeof def.name === 'string', `${def.name}: name should be string`);
        this.assert(typeof def.description === 'string', `${def.name}: description should be string`);
        this.assert(typeof def.input_schema === 'object', `${def.name}: input_schema should be object`);
        this.assertEq(def.input_schema.type, 'object', `${def.name}: input_schema type should be object`);
        this.assert(def.input_schema.properties, `${def.name}: input_schema should have properties`);
      }
    }
  });
}.module({
  name: 'test.tools',
  imports: [base, test, coreTools, tools],
}).load();
