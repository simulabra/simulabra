import * as Base from './base.js';
import { parseScript } from "meriyah";

// https://github.com/estree/estree/blob/master/es5.md
export const ESTreeTransformer = Base.Class.new({
  name: 'ESTreeTransformer',
  doc: 'transforms estree objects to nodes',
  slots: {
    nodeClasses: Base.Var.default({}),
    nodeClass: Base.Method.do(function nodeClass(type) {
      if (type in this.nodeClasses()) {
        return this.nodeClasses()[type];
      } else {
        console.log('Unhandled type ' + type);
        return null;
      }
    }),
    register: Base.Method.do(function register(nodeClass) {
      this.nodeClasses()[nodeClass.name()] = nodeClass;
    }),
    registerAlias: Base.Method.do(function register(name, nodeClass) {
      this.nodeClasses()[name] = nodeClass;
    }),
    init() {
      for (const nsub of Node.subclasses()) {
        this.register(nsub);
      }
    },
    transform: Base.Method.do(function transform(estree) {
      if (Array.isArray(estree)) {
        return estree.map(e => this.transform(e));
      } else if (typeof estree !== 'object') {
        return estree;
      }
      // console.log(estree)
      return this.nodeClass(estree.type)?.new(this.body(estree));
    }),
    body: Base.Method.do(function body(estree) {
      const o = {};
      for (const [k, v] of Object.entries(estree)) {
        if (k === 'start' || k === 'end') {
          o[k] = v;
        } else if (k !== 'ranges') {
          o[k] = this.transform(v);
        }
      }
      return o;
    }),
    parse: Base.Method.do(function parse(source) {
      return parseScript(source, {
        ranges: true,
        module: true,
      });
    }),
  }
});

export const Node = Base.Class.new({
  name: 'Node',
  static: {
    subNode: Base.Method.do(function subNode(name, ...slotNames) {
      const slots = {};
      for (const slot of slotNames) {
        slots[slot] = Base.Var.new();
      }
      return Base.Class.new({
        name: name,
        super: Node,
        slots: slots,
      });
    }),
  },
  slots: {
    start: Base.Var.new(),
    end: Base.Var.new(),
    fields: Base.Method.do(function fields() {

    }),
    format: Base.Method.do(function format() {
      return `(${this.name()} ${this.fields()})`
    }),
  }
});

export const Program = Base.Class.new({
  name: 'Program',
  super: Node,
  slots: {
    body: Base.Var.new(),
  },
});

export const Function = Base.Class.new({
  name: 'Function',
  super: Node,
  slots: {
    id: Base.Var.new(),
    params: Base.Var.new(),
    body: Base.Var.new(),
  }
});

export const FunctionDeclaration = Base.Class.new({
  name: 'FunctionDeclaration',
  super: Node,
  slots: {
    id: Base.Var.new(),
    params: Base.Var.new(),
    body: Base.Var.new(),
  }
});

export const Identifier = Base.Class.new({
  name: 'Identifier',
  super: Node,
  slots: {
    name: Base.Var.new(),
  }
});

export const BlockStatement = Base.Class.new({
  name: 'BlockStatement',
  super: Node,
  slots: {
    body: Base.Var.new(),
  }
});

export const ReturnStatement = Base.Class.new({
  name: 'ReturnStatement',
  super: Node,
  slots: {
    argument: Base.Var.new(),
  }
});

export const BinaryExpression = Base.Class.new({
  name: 'BinaryExpression',
  super: Node,
  slots: {
    left: Base.Var.new(),
    right: Base.Var.new(),
    operator: Base.Var.new(),
  }
});

export const Literal = Base.Class.new({
  name: 'Literal',
  super: Node,
  slots: {
    value: Base.Var.new(),
  }
});

// export const ImportDeclaration = Base.Class.new({
//   name: 'ImportDeclaration',
//   super: Node,
//   slots: {

//   }
// })
