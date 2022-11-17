import { test } from 'uvu';
import * as assert from 'uvu/assert';
import Base from '../base.js';

test('basic', () => {
  const Frobber = Base.Class.new({
    _name: Base.$$`Frobber`,
    _slots: {
      frob() {
        return 42;
      }
    }
  });

  assert.is(Frobber.new().frob(), 42);
});


const Point = Base.Class.new({
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

test('point', () => {
  assert.is(Point.new({ _x: 3, _y: 4 }).dist(), 5);
  let t = Point.new();
  t.translate(3, 4);
  assert.is(t.dist(), 5);
  assert.is(Point.new().dist(), 0);
  assert.is(Point.class().eq(Base.Class), true);
  assert.is(t.class().eq(Point), true);

  const LocTest = Base.Class.new({
    _name: Base.$$`LocTest`,
    _slots: {
      p: Base.Var.new({
        default: () => Point.new()
      }),
      move() {
        this.p().translate(1);
      },
      dist() {
        return this.p().dist();
      }
    }
  });

  let l1 = LocTest.new();
  let l2 = LocTest.new();
  l1.move();
  l1.move();
  assert.is(l1.dist(), 2);
  assert.is(l2.dist(), 0);
});

test('mixins', () => {
  let ColorMixin = Base.Mixin.new({
    _name: Base.$$`ColorMixin`,
    _slots: {
      r: Base.Var.default(0),
      g: Base.Var.default(0),
      b: Base.Var.default(0),
      format: Base.Method.do(function() {
        return `(${this.r()}, ${this.g()}, ${this.b()})`;
      }),
    }
  });

  const ColorPoint = Base.Class.new({
    _name: Base.$$`ColorPoint`,
    _mixins: [ColorMixin],
    _super: Point,
  });

  const p = ColorPoint.new({
    _x: 3,
    _y: 4,
    _g: 12,
    _b: 77
  });

  assert.is(p.dist(), 5);
  assert.is(p.format(), '(0, 12, 77)');
});

test('inheritance', () => {
  const ChildPoint = Base.Class.new({
    _name: Base.$$`ChildPoint`,
    _super: Point,
    _slots: {
      dist() {
        // note baked in super class - can we fix this in a nice way?
        return ChildPoint.super().proto().dist.apply(this) / 2;
      }
    }
  });

  assert.is(ChildPoint.new({ _x: 3, _y: 4 }).dist(), 2.5);

  const SmallerPoint = Base.Class.new({
    _name: Base.$$`SmallerPoint`,
    _super: ChildPoint,
    _slots: {
      dist() {
        return SmallerPoint.super().proto().dist.apply(this) / 5;
      }
    }
  });

  assert.is(SmallerPoint.new({ _x: 3, _y: 4 }).dist(), 0.5);
  assert.is(SmallerPoint.new().translate(4, 0).dist(), 0.4);

  const TinyPoint = Base.Class.new({
    _name: Base.$$`TinyPoint`,
    _super: SmallerPoint,
    _slots: {
      dist() {
        return TinyPoint.super().proto().dist.apply(this) / 10;
      }
    }
  });

  assert.is(TinyPoint.new({ _x: 3, _y: 4 }).dist(), 0.05);
});

test('symbols', () => {
  assert.is(Base.$$`test`.eq(Base.$$`test`), true);
  assert.is(`<${Base.$$`test`}>`, '<test>');
  assert.is(Point.name().eq(Base.$$`Point`), true);
});

test('getters n setters', () => {
  let p = Point.new({
    _x: 6,
    _y: 7.5,
  });

  assert.is(p.x() * p.y(), 45);
  assert.is(p.y(10), 10);
  assert.is(p.x() * p.y(), 60);

  const WatchedPoint = Base.Class.new({
    _name: Base.$$`WatchedPoint`,
    _super: Point,
    _slots: {
      update(event) {
        this._last = event;
      },
    }
  });

  const wp = WatchedPoint.new();
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

  const arr = [Point, Base.Class];
  const arrMap = arr.intoMap();
  assert.is(arrMap.Point, Point);
  assert.is(arrMap.Class, Base.Class);
});

test.run();
