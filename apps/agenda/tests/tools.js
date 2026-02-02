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

      this.assertEq(registry.tools().length, 13, 'should have 13 tools');

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
          createLog: (args) => {
            calledWith = args;
            return { id: 'test-id', ...args };
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

  $test.Case.new({
    name: 'ToolRegistryCount',
    doc: 'AgendaToolRegistry should have 13 tools after project tools added',
    do() {
      const registry = $tools.AgendaToolRegistry.new();
      this.assertEq(registry.tools().length, 13, 'should have 13 tools');

      const toolNames = registry.tools().map(t => t.toolName());
      this.assert(toolNames.includes('create_project'), 'should have create_project');
      this.assert(toolNames.includes('list_projects'), 'should have list_projects');
      this.assert(toolNames.includes('update_project'), 'should have update_project');
      this.assert(toolNames.includes('move_to_project'), 'should have move_to_project');
    }
  });

  $test.Case.new({
    name: 'CreateProjectToolSchema',
    doc: 'create_project should require title, with slug and context optional',
    do() {
      const registry = $tools.AgendaToolRegistry.new();
      const tool = registry.get('create_project');
      const schema = tool.inputSchema();

      this.assert(schema.properties.title, 'should have title property');
      this.assert(schema.properties.slug, 'should have slug property');
      this.assert(schema.properties.context, 'should have context property');
      this.assert(schema.required.includes('title'), 'title should be required');
      this.assert(!schema.required.includes('slug'), 'slug should not be required');
      this.assert(!schema.required.includes('context'), 'context should not be required');
    }
  });

  $test.Case.new({
    name: 'MoveToProjectToolSchema',
    doc: 'move_to_project should require itemType and itemId, with projectId and projectSlug optional',
    do() {
      const registry = $tools.AgendaToolRegistry.new();
      const tool = registry.get('move_to_project');
      const schema = tool.inputSchema();

      this.assert(schema.properties.itemType, 'should have itemType property');
      this.assert(schema.properties.itemId, 'should have itemId property');
      this.assert(schema.properties.projectId, 'should have projectId property');
      this.assert(schema.properties.projectSlug, 'should have projectSlug property');
      this.assert(schema.required.includes('itemType'), 'itemType should be required');
      this.assert(schema.required.includes('itemId'), 'itemId should be required');
      this.assert(!schema.required.includes('projectId'), 'projectId should not be required');
      this.assert(!schema.required.includes('projectSlug'), 'projectSlug should not be required');
    }
  });

  $test.Case.new({
    name: 'CreateTaskToolSchemaExtended',
    doc: 'create_task should now include optional projectId in schema',
    do() {
      const registry = $tools.AgendaToolRegistry.new();
      const createTask = registry.get('create_task');
      const schema = createTask.inputSchema();

      this.assert(schema.properties.projectId, 'create_task should have projectId property');
      this.assertEq(schema.properties.projectId.type, 'string', 'projectId should be string type');
      this.assert(!schema.required || !schema.required.includes('projectId'), 'projectId should not be required');

      const createLog = registry.get('create_log');
      this.assert(createLog.inputSchema().properties.projectId, 'create_log should have projectId property');

      const createReminder = registry.get('create_reminder');
      this.assert(createReminder.inputSchema().properties.projectId, 'create_reminder should have projectId property');

      const listTasks = registry.get('list_tasks');
      this.assert(listTasks.inputSchema().properties.projectId, 'list_tasks should have projectId property');

      const listLogs = registry.get('list_logs');
      this.assert(listLogs.inputSchema().properties.projectId, 'list_logs should have projectId property');

      const listReminders = registry.get('list_reminders');
      this.assert(listReminders.inputSchema().properties.projectId, 'list_reminders should have projectId property');
    }
  });

  $test.AsyncCase.new({
    name: 'ToolExecuteCreateProject',
    doc: 'create_project tool should call db.createProject with correct args',
    async do() {
      const registry = $tools.AgendaToolRegistry.new();

      let calledWith = null;
      const mockServices = {
        db: {
          createProject: (args) => {
            calledWith = args;
            return { id: 'proj-1', ...args };
          }
        }
      };

      const result = await registry.execute('create_project', { title: 'Coins', slug: 'coins', context: 'Ancient coin cleaning' }, mockServices);

      this.assert(result.success, 'should succeed');
      this.assertEq(calledWith.title, 'Coins', 'should pass title');
      this.assertEq(calledWith.slug, 'coins', 'should pass slug');
      this.assertEq(calledWith.context, 'Ancient coin cleaning', 'should pass context');
    }
  });

  $test.AsyncCase.new({
    name: 'ToolExecuteMoveToProjectBySlug',
    doc: 'move_to_project should resolve projectSlug to projectId and dispatch to correct update method',
    async do() {
      const registry = $tools.AgendaToolRegistry.new();

      let updateCalledWith = null;
      const mockServices = {
        db: {
          getProjectBySlug: ({ slug }) => {
            return { id: 'proj-abc', title: 'House', slug };
          },
          updateTask: (args) => {
            updateCalledWith = args;
            return { id: args.id, projectId: args.projectId };
          }
        }
      };

      const result = await registry.execute('move_to_project', { itemType: 'task', itemId: 'task-123', projectSlug: 'house' }, mockServices);

      this.assert(result.success, 'should succeed');
      this.assertEq(updateCalledWith.id, 'task-123', 'should pass item id');
      this.assertEq(updateCalledWith.projectId, 'proj-abc', 'should resolve slug to project id');
    }
  });
}.module({
  name: 'test.tools',
  imports: [base, test, coreTools, tools],
}).load();
