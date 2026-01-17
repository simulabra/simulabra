import { __, base } from './base.js';

export default await async function (_, $) {
  $.Class.new({
    name: 'Tool',
    doc: 'Base class for LLM-callable tools with unified definition and execution',
    slots: [
      $.Var.new({ name: 'toolName', doc: 'the name of this tool' }),
      $.Var.new({
        name: 'doc',
        doc: 'description of what the tool does (shown to LLM)',
      }),
      $.Var.new({
        name: 'inputSchema',
        doc: 'JSON schema for the tool input',
      }),
      $.Method.new({
        name: 'definition',
        doc: 'returns the Anthropic tool definition',
        do() {
          return {
            name: this.toolName(),
            description: this.doc(),
            input_schema: this.inputSchema(),
          };
        }
      }),
      $.Virtual.new({
        name: 'execute',
        doc: 'execute the tool with given args and services context',
      }),
    ]
  });

  $.Class.new({
    name: 'ToolRegistry',
    doc: 'Registry of tools with lookup and execution dispatch',
    slots: [
      $.Var.new({
        name: 'tools',
        doc: 'array of Tool objects',
        default: () => [],
      }),
      $.Var.new({
        name: 'toolMap',
        doc: 'map of tool name to Tool object (computed lazily)',
      }),
      $.Method.new({
        name: 'register',
        doc: 'add a tool to the registry',
        do(tool) {
          this.tools().push(tool);
          this.toolMap(null);
          return this;
        }
      }),
      $.Method.new({
        name: 'getToolMap',
        doc: 'get or build the name->tool map',
        do() {
          if (!this.toolMap()) {
            const map = {};
            for (const tool of this.tools()) {
              map[tool.toolName()] = tool;
            }
            this.toolMap(map);
          }
          return this.toolMap();
        }
      }),
      $.Method.new({
        name: 'get',
        doc: 'get a tool by name',
        do(name) {
          return this.getToolMap()[name];
        }
      }),
      $.Method.new({
        name: 'definitions',
        doc: 'returns array of all tool definitions for the Claude API',
        do() {
          return this.tools().map(t => t.definition());
        }
      }),
      $.Method.new({
        name: 'execute',
        doc: 'execute a tool by name with given args and services context',
        async do(toolName, args, services) {
          const tool = this.get(toolName);
          if (!tool) {
            return { success: false, error: `Unknown tool: ${toolName}` };
          }
          try {
            const result = await tool.execute(args, services);
            return { success: true, data: result };
          } catch (e) {
            return { success: false, error: e.message };
          }
        }
      }),
    ]
  });
}.module({
  name: 'tools',
  imports: [base],
}).load();
