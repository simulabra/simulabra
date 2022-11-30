import Base from './base.js';
import { parseScript } from "meriyah";

// https://github.com/estree/estree/blob/master/es5.md
const _ESTreeTransformer = Base.Class.new({
  _name: 'ESTreeTransformer',
  _doc: 'transforms estree objects to nodes',
  _slots: {
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
        const pk = '_' + k;
        if (k === 'start' || k === 'end') {
          o[pk] = v;
        } else if (k !== 'ranges') {
          o[pk] = this.transform(v);
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
  _name: 'Node',
  _static: {
    subNode: Base.Method.do(function subNode(name, ...slotNames) {
      const slots = {};
      for (const slot of slotNames) {
        slots[slot] = Base.Var.new();
      }
      return Base.Class.new({
        _name: name,
        _super: _Node,
        _slots: slots,
      });
    }),
  },
  _slots: {
    start: Base.Var.new(),
    end: Base.Var.new(),
  }
});

const _Program = Base.Class.new({
  _name: 'Program',
  _super: _Node,
  _slots: {
    body: Base.Var.new(),
  }
});

const _Function = Base.Class.new({
  _name: 'Function',
  _super: _Node,
  _slots: {
    id: Base.Var.new(),
    params: Base.Var.new(),
    body: Base.Var.new(),
  }
});

const _FunctionDeclaration = Base.Class.new({
  _name: 'FunctionDeclaration',
  _super: _Node,
  _slots: {
    id: Base.Var.new(),
    params: Base.Var.new(),
    body: Base.Var.new(),
  }
});

const _Identifier = Base.Class.new({
  _name: 'Identifier',
  _super: _Node,
  _slots: {
    name: Base.Var.new(),
  }
});

const _BlockStatement = Base.Class.new({
  _name: 'BlockStatement',
  _super: _Node,
  _slots: {
    body: Base.Var.new(),
  }
});

const _ReturnStatement = Base.Class.new({
  _name: 'ReturnStatement',
  _super: _Node,
  _slots: {
    argument: Base.Var.new(),
  }
});

const _BinaryExpression = Base.Class.new({
  _name: 'BinaryExpression',
  _super: _Node,
  _slots: {
    left: Base.Var.new(),
    right: Base.Var.new(),
    operator: Base.Var.new(),
  }
});

const _Literal = Base.Class.new({
  _name: 'Literal',
  _super: _Node,
  _slots: {
    value: Base.Var.new(),
  }
});


const _ = Base.Module.new({
  _exports: [
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
