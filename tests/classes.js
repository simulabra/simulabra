import { test } from 'uvu';
import * as assert from 'uvu/assert';
import * as Base from '../base.js';
import * as HTML from '../html.js';

const Frobber = Base.Class.new({
  name: 'Frobber',
  slots: {
    frob() {
      return 42;
    }
  }
});

const Point = Base.Class.new({
  name: 'Point',
  slots: {
    x: Base.Var.default(0),
    y: Base.Var.default(0),
    dist: Base.Method.new({
      do: function dist() {
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

const LocTest = Base.Class.new({
  name: 'LocTest',
  slots: {
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

const ColorMixin = Base.Mixin.new({
  name: 'ColorMixin',
  slots: {
    r: Base.Var.default(0),
    g: Base.Var.default(0),
    b: Base.Var.default(0),
    format: Base.Method.do(function () {
      return `(${this.r()}, ${this.g()}, ${this.b()})`;
    }),
  }
});

const ColorPoint = Base.Class.new({
  name: 'ColorPoint',
  mixins: [ColorMixin],
  super: Point,
});

const ChildPoint = Base.Class.new({
  name: 'ChildPoint',
  super: Point,
  slots: {
    dist() {
      // note baked in super class - can we fix this in a nice way?
      return ChildPoint.super().proto().dist.apply(this) / 2;
    }
  }
});

const SmallerPoint = Base.Class.new({
  name: 'SmallerPoint',
  super: ChildPoint,
  slots: {
    dist() {
      return SmallerPoint.super().proto().dist.apply(this) / 5;
    }
  }
});

const TinyPoint = Base.Class.new({
  name: 'TinyPoint',
  super: SmallerPoint,
  slots: {
    dist() {
      return TinyPoint.super().proto().dist.apply(this) / 10;
    }
  }
});

const WatchedPoint = Base.Class.new({
  name: 'WatchedPoint',
  super: Point,
  slots: {
    update(event) {
      this._last = event;
    },
  }
});

test('basic', () => {
  assert.is(Frobber.new().frob(), 42);
});

test('point', () => {
  assert.is(Point.new({ x: 3, y: 4 }).dist(), 5);
  let t = Point.new();
  t.translate(3, 4);
  assert.is(t.dist(), 5);
  assert.is(Point.new().dist(), 0);
  assert.is(Point.class().eq(Base.Class), true);
  assert.is(t.class().eq(Point), true);

  let l1 = LocTest.new();
  let l2 = LocTest.new();
  l1.move();
  l1.move();
  assert.is(l1.dist(), 2);
  assert.is(l2.dist(), 0);
});

test('mixins', () => {
  const p = ColorPoint.new({
    x: 3,
    y: 4,
    g: 12,
    b: 77
  });

  assert.is(p.dist(), 5);
  assert.is(p.format(), '(0, 12, 77)');
});

test('inheritance', () => {
  assert.is(ChildPoint.new({ x: 3, y: 4 }).dist(), 2.5);

  assert.is(SmallerPoint.new({ x: 3, y: 4 }).dist(), 0.5);
  assert.is(SmallerPoint.new().translate(4, 0).dist(), 0.4);

  assert.is(TinyPoint.new({ x: 3, y: 4 }).dist(), 0.05);

  assert.equal(Point.subclasses().map(sub => sub.name()), ['ColorPoint', 'ChildPoint', 'WatchedPoint']);
});

test('getters n setters', () => {
  let p = Point.new({
    x: 6,
    y: 7.5,
  });

  assert.is(p.x() * p.y(), 45);
  assert.is(p.y(10), 10);
  assert.is(p.x() * p.y(), 60);

  const wp = WatchedPoint.new();
  wp.x(4);
  assert.is(wp._last.changed, 'x');
});

test('primitives', () => {
  assert.is((4 + 5).sqrt(), 3);

  const arr = [Point, Base.Class];
  const arrMap = arr.intoMap();
  assert.is(arrMap.Point, Point);
  assert.is(arrMap.Class, Base.Class);
});

test('html', () => {
  const div = HTML.Div.new({
    inner: 'hello there!',
  });
})

test.run();
