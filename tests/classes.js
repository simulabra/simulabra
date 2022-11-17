import { test } from 'uvu';
import * as assert from 'uvu/assert';
import Base from '../base.js';

const _Frobber = Base.Class.new({
  _name: Base.$$`Frobber`,
  _slots: {
    frob() {
      return 42;
    }
  }
});
const _Point = Base.Class.new({
  _name: Base.$$`Point`,
  _slots: {
    x: Base.Var.default(0),
    y: Base.Var.default(0),
    dist: Base.Method.new({
      _do: function dist() {
        return (this.x().square() + this.y().square()).sqrt();
      },
    }),
    translate(x = 0, y = 0) {
      this.x(this.x() + x);
      this.y(this.y() + y);
      return this;
    }
  }
});
const _LocTest = Base.Class.new({
  _name: Base.$$`LocTest`,
  _slots: {
    p: Base.Var.new({
      default: () => _Point.new()
    }),
    move() {
      this.p().translate(1);
    },
    dist() {
      return this.p().dist();
    }
  }
});
let _ColorMixin = Base.Mixin.new({
  _name: Base.$$`ColorMixin`,
  _slots: {
    r: Base.Var.default(0),
    g: Base.Var.default(0),
    b: Base.Var.default(0),
    format: Base.Method.do(function () {
      return `(${this.r()}, ${this.g()}, ${this.b()})`;
    }),
  }
});
const _ColorPoint = Base.Class.new({
  _name: Base.$$`ColorPoint`,
  _mixins: [_ColorMixin],
  _super: _Point,
});
const _ChildPoint = Base.Class.new({
  _name: Base.$$`ChildPoint`,
  _super: _Point,
  _slots: {
    dist() {
      // note baked in super class - can we fix this in a nice way?
      return _ChildPoint.super().proto().dist.apply(this) / 2;
    }
  }
});
const _SmallerPoint = Base.Class.new({
  _name: Base.$$`SmallerPoint`,
  _super: _ChildPoint,
  _slots: {
    dist() {
      return _SmallerPoint.super().proto().dist.apply(this) / 5;
    }
  }
});
const _TinyPoint = Base.Class.new({
  _name: Base.$$`TinyPoint`,
  _super: _SmallerPoint,
  _slots: {
    dist() {
      return _TinyPoint.super().proto().dist.apply(this) / 10;
    }
  }
});
const _WatchedPoint = Base.Class.new({
  _name: Base.$$`WatchedPoint`,
  _super: _Point,
  _slots: {
    update(event) {
      this._last = event;
    },
  }
});


const _ = Base.Module.new({
  _exports: [
    _Frobber,
    _Point,
    _LocTest,
    _ColorMixin,
    _ColorPoint,
    _ChildPoint,
    _SmallerPoint,
    _TinyPoint,
    _WatchedPoint,
  ]
});

test('basic', () => {
  assert.is(_Frobber.new().frob(), 42);
});

test('point', () => {
  assert.is(_.Point.new({ _x: 3, _y: 4 }).dist(), 5);
  let t = _.Point.new();
  t.translate(3, 4);
  assert.is(t.dist(), 5);
  assert.is(_.Point.new().dist(), 0);
  assert.is(_.Point.class().eq(Base.Class), true);
  assert.is(t.class().eq(_.Point), true);

  let l1 = _.LocTest.new();
  let l2 = _.LocTest.new();
  l1.move();
  l1.move();
  assert.is(l1.dist(), 2);
  assert.is(l2.dist(), 0);
});

test('mixins', () => {
  const p = _.ColorPoint.new({
    _x: 3,
    _y: 4,
    _g: 12,
    _b: 77
  });

  assert.is(p.dist(), 5);
  assert.is(p.format(), '(0, 12, 77)');
});

test('inheritance', () => {
  assert.is(_.ChildPoint.new({ _x: 3, _y: 4 }).dist(), 2.5);

  assert.is(_.SmallerPoint.new({ _x: 3, _y: 4 }).dist(), 0.5);
  assert.is(_.SmallerPoint.new().translate(4, 0).dist(), 0.4);

  assert.is(_.TinyPoint.new({ _x: 3, _y: 4 }).dist(), 0.05);
});

test('symbols', () => {
  assert.is(Base.$$`test`.eq(Base.$$`test`), true);
  assert.is(`<${Base.$$`test`}>`, '<test>');
  assert.is(_.Point.name().eq(Base.$$`Point`), true);
});

test('getters n setters', () => {
  let p = _.Point.new({
    _x: 6,
    _y: 7.5,
  });

  assert.is(p.x() * p.y(), 45);
  assert.is(p.y(10), 10);
  assert.is(p.x() * p.y(), 60);

  const wp = _.WatchedPoint.new();
  wp.x(4);
  assert.is(wp._last.changed, 'x');
});

test('primitives', () => {
  const obj = { a: true };
  assert.is(typeof obj.init, 'function');

  obj.aname('test');
  assert.is(obj._name.toString(), 'test');

  assert.is('test 2'.sym().toString(), 'test 2');

  assert.is((4 + 5).sqrt(), 3);

  const arr = [_.Point, Base.Class];
  const arrMap = arr.intoMap();
  assert.is(arrMap.Point, _.Point);
  assert.is(arrMap.Class, Base.Class);
});

test.run();
