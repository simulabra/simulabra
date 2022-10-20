import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { _ as env } from '../base.js';

const _ = env.child();

test('env', () => {
  _.define(_.klass.new({
    _name: _.symbol.sym('frobber'),
    _slots: {
      frob() {
        return 42;
      }
    }
  }));

  assert.is(_.frobber.new().frob(), 42);
  assert.is(env.frobber, undefined);
})


_.define(_.klass.new({
  _name: _.symbol.sym('point'),
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
  assert.is(_.point.new({ _x: 3, _y: 4 }).dist(), 5);
  let t = _.point.new();
  t.translate({ _x: 3, _y: 4 });
  assert.is(t.dist(), 5);
  assert.is(_.point.new().dist(), 0);

  _.define(_.klass.new({
    _name: _.symbol.sym('loc-test'),
    _slots: {
      _p: () => _.point.new(),
      move() {
        this._p.translate({ _x: 1 });
      },
      dist() {
        return this._p.dist();
      }
    }
  }));

  let l1 = _.loc_test.new();
  let l2 = _.loc_test.new();
  l1.move();
  l1.move();
  assert.is(l1.dist(), 2);
  assert.is(l2.dist(), 0);
});

test('mixins', () => {
  let m = _.mixin.new({
    _name: _.symbol.sym('color-mixin'),
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

  _.define(_.klass.new({
    _name: _.symbol.sym('color-point'),
    _mixins: [m],
    _super: _.point,
  }));

  const p = _.color_point.new({
    _x: 3,
    _y: 4,
    _g: 12,
    _b: 77
  });

  assert.is(p.dist(), 5);
  assert.is(p.format(), '(0, 12, 77)');
});

test('inheritance', () => {
  _.define(_.klass.new({
    _name: _.symbol.sym('child-point'),
    _super: _.point,
    _slots: {
      dist() {
        // note baked in super class - can we fix this in a nice way?
        return _.child_point.super().dist.apply(this) / 2;
      }
    }
  }));

  assert.is(_.child_point.new({ _x: 3, _y: 4 }).dist(), 2.5);

  _.define(_.klass.new({
    _name: _.symbol.sym('smaller-point'),
    _super: _.child_point,
    _slots: {
      dist() {
        return _.smaller_point.super().dist.apply(this) / 5;
      }
    }
  }));

  assert.is(_.smaller_point.new({ _x: 3, _y: 4 }).dist(), 0.5);
  assert.is(_.smaller_point.new().translate({ _x: 4, _y: 0 }).dist(), 0.4);

  _.define(_.klass.new({
    _name: _.symbol.sym('tiny-point'),
    _super: _.smaller_point,
    _slots: {
      dist() {
        return _.tiny_point.super().dist.apply(this) / 10;
      }
    }
  }));

  assert.is(_.tiny_point.new({ _x: 3, _y: 4 }).dist(), 0.05);
});

test('symbols', () => {
  assert.is(_.symbol.sym('test').eq(_.symbol.sym('test')), true);
  assert.is(`<${_.symbol.sym('test')}>`, '<test>');
  assert.is(_.point.name().eq(_.symbol.sym('point')), true);
})

test('parser', () => {
  const parser = _.parser.new({
    _js: '1 + 1'
  });

  const repr = parser._acorn_repr;

  assert.is(repr.type, 'Program');
  assert.is(repr.body[0].expression.type, 'BinaryExpression');
  assert.is(repr.body[0].expression.left.value, 1);
  assert.is(repr.body[0].expression.right.value, 1);
  let program = parser.program();
  assert.is(program.expressions()[0].js(), '1 + 1');

  const p2 = _.parser.new({
    _js: 'let o = { _test: 42 }'
  });
  console.log(_.parser.id().toString());
})

test.run();
