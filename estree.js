import Base from './base.js';
import { parseScript } from "meriyah";

// https://github.com/estree/estree/blob/master/es5.md
const _ESTreeTransformer = Base.Class.new({
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
      for (let nsub of _Node.subclasses()) {
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
      });
    }),
  }
});

const _Node = Base.Class.new({
  name: 'Node',
  static: {
    subNode: Base.Method.do(function subNode(name, ...slotNames) {
      const slots = {};
      for (const slot of slotNames) {
        slots[slot] = Base.Var.new();
      }
      return Base.Class.new({
        name: name,
        super: _Node,
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

// const _Program = Base.Class.new({
//   _name: 'Program',
//   _super: _Node,
//   _slots: {
//     body: Base.Var.new(),
//   }
// });

const _Program = Base.Class.new({
  name: 'Program',
  super: _Node,
  slots: {
    body: Base.Var.new(),
  },
});

const _Function = Base.Class.new({
  name: 'Function',
  super: _Node,
  slots: {
    id: Base.Var.new(),
    params: Base.Var.new(),
    body: Base.Var.new(),
  }
});

const _FunctionDeclaration = Base.Class.new({
  name: 'FunctionDeclaration',
  super: _Node,
  slots: {
    id: Base.Var.new(),
    params: Base.Var.new(),
    body: Base.Var.new(),
  }
});

const _Identifier = Base.Class.new({
  name: 'Identifier',
  super: _Node,
  slots: {
    name: Base.Var.new(),
  }
});

const _BlockStatement = Base.Class.new({
  name: 'BlockStatement',
  super: _Node,
  slots: {
    body: Base.Var.new(),
  }
});

const _ReturnStatement = Base.Class.new({
  name: 'ReturnStatement',
  super: _Node,
  slots: {
    argument: Base.Var.new(),
  }
});

const _BinaryExpression = Base.Class.new({
  name: 'BinaryExpression',
  super: _Node,
  slots: {
    left: Base.Var.new(),
    right: Base.Var.new(),
    operator: Base.Var.new(),
  }
});

const _Literal = Base.Class.new({
  name: 'Literal',
  super: _Node,
  slots: {
    value: Base.Var.new(),
  }
});


const _ = Base.Module.new({
  exports: [
    _ESTreeTransformer,
    _Node,
    _Program,
    _Function,
    _FunctionDeclaration,
    _Identifier,
    _BlockStatement,
    _ReturnStatement,
    _BinaryExpression,
    _Literal,
  ]
});

export default _;
