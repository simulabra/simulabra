import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { oClass } from '../smoperat.js';

let Point = oClass.new({
  _name: 'point',
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
})

test('point', () => {

  assert.is(Point.new({ _x: 3, _y: 4 }).dist(), 5);
  let t = Point.new();
  t.translate({ _x: 3, _y: 4 });
  assert.is(t.dist(), 5);
  assert.is(Point.new().dist(), 0);

  let LocTest = oClass.new({
    name: 'LocTest',
    _slots: {
      _p: () => Point.new(),
      move() {
        this._p.translate({ _x: 1 });
      },
      dist() {
        return this._p.dist();
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
  function ColorMixin(base) {
    return {
      _r: 0,
      _g: 0,
      _b: 0,
      format() {
        return `(${this._r}, ${this._g}, ${this._b})`;
      },
      ...base
    };
  }

  let ColorPoint = oClass.new({
    _name: 'color-point',
    _mixins: [ColorMixin],
    _super: Point,
  });

  let p = ColorPoint.new({
    _x: 3,
    _y: 4,
    _g: 12,
    _b: 77
  });

  assert.is(p.dist(), 5);
  assert.is(p.format(), '(0, 12, 77)');
});

test('inheritance', () => {
  let ChildPoint = oClass.new({
    _name: 'child-point',
    _super: Point,
    _slots: {
      dist() {
        return this.super('dist') / 2;
      }
    }
  });

  assert.is(ChildPoint.new({ _x: 3, _y: 4 }).dist(), 2.5);

  let SmallerPoint = oClass.new({
    _name: 'smaller-point',
    _super: ChildPoint,
    _slots: {
      dist() {
        return this.super('dist') / 5;
      }
    }
  });

  assert.is(SmallerPoint.new({ _x: 3, _y: 4 }).dist(), 0.5);
  assert.is(SmallerPoint.new().translate({ _x: 4, _y: 0 }).dist(), 0.4);
});

test.run();
