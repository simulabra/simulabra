import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { env } from '../base.js';

const e = env.child();

test('env', () => {
  e.define(e.klass.new({
    _name: e.symbol.sym('frobber'),
    _slots: {
      frob() {
        return 42;
      }
    }
  }));

  assert.is(e.frobber.new().frob(), 42);
  assert.is(env.frobber, undefined);
})


e.define(e.klass.new({
  _name: e.symbol.sym('point'),
  _slots: {
    _x: 0,
    _y: 0,
    dist() {
      return Math.sqrt(this._x ** 2 + this._y ** 2);
    },
    translate({ _x = 0, _y = 0 }) {
      this._x += _x;
      this._y += _y;
      return this;
    }
  }
}));

test('point', () => {
  assert.is(e.point.new({ _x: 3, _y: 4 }).dist(), 5);
  let t = e.point.new();
  t.translate({ _x: 3, _y: 4 });
  assert.is(t.dist(), 5);
  assert.is(e.point.new().dist(), 0);

  e.define(e.klass.new({
    _name: e.symbol.sym('loc-test'),
    _slots: {
      _p: () => e.point.new(),
      move() {
        this._p.translate({ _x: 1 });
      },
      dist() {
        return this._p.dist();
      }
    }
  }));

  let l1 = e.loc_test.new();
  let l2 = e.loc_test.new();
  l1.move();
  l1.move();
  assert.is(l1.dist(), 2);
  assert.is(l2.dist(), 0);
});

test('mixins', () => {
  let m = e.mixin.new({
    _name: e.symbol.sym('color-mixin'),
    _slots: {
      _r: 0,
      _g: 0,
      _b: 0,
      format() {
        return `(${this._r}, ${this._g}, ${this._b})`;
      },
    }
  })

  assert.is(m.mix({})._r, 0);

  e.define(e.klass.new({
    _name: e.symbol.sym('color-point'),
    _mixins: [m],
    _super: e.point,
  }));

  const p = e.color_point.new({
    _x: 3,
    _y: 4,
    _g: 12,
    _b: 77
  });

  assert.is(p.dist(), 5);
  assert.is(p.format(), '(0, 12, 77)');
});

test('inheritance', () => {
  e.define(e.klass.new({
    _name: e.symbol.sym('child-point'),
    _super: e.point,
    _slots: {
      dist() {
        // note baked in super class - can we fix this in a nice way?
        return e.child_point.super().dist.apply(this) / 2;
      }
    }
  }));

  assert.is(e.child_point.new({ _x: 3, _y: 4 }).dist(), 2.5);

  e.define(e.klass.new({
    _name: e.symbol.sym('smaller-point'),
    _super: e.child_point,
    _slots: {
      dist() {
        return e.smaller_point.super().dist.apply(this) / 5;
      }
    }
  }));

  assert.is(e.smaller_point.new({ _x: 3, _y: 4 }).dist(), 0.5);
  assert.is(e.smaller_point.new().translate({ _x: 4, _y: 0 }).dist(), 0.4);

  e.define(e.klass.new({
    _name: e.symbol.sym('tiny-point'),
    _super: e.smaller_point,
    _slots: {
      dist() {
        return e.tiny_point.super().dist.apply(this) / 10;
      }
    }
  }));

  assert.is(e.tiny_point.new({ _x: 3, _y: 4 }).dist(), 0.05);
});

test('symbols', () => {
  assert.is(e.symbol.sym('test').eq(e.symbol.sym('test')), true);
  assert.is(`<${e.symbol.sym('test')}>`, '<test>');
  assert.is(e.point.name().eq(e.symbol.sym('point')), true);
})

test('parser', () => {
  const parser = e.parser.new({
    _js: '1 + 1'
  });

  const repr = parser._acorn_repr;

  assert.is(repr.type, 'Program');
  assert.is(repr.body[0].expression.type, 'BinaryExpression');
  assert.is(repr.body[0].expression.left.value, 1);
  assert.is(repr.body[0].expression.right.value, 1);
  let program = parser.program();
  assert.is(program.expressions()[0].js(), '1 + 1');
  assert.is(program.run(e), 2);
})

test.run();
