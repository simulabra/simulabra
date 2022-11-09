import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { $mixin, $class, $var, $$ } from '../base.js';

test('basic', () => {
  const $frobber = $class.new({
    _name: $$`frobber`,
    _slots: {
      frob() {
        return 42;
      }
    }
  });

  assert.is($frobber.new().frob(), 42);
});


const $point = $class.new({
  _name: $$`point`,
  _slots: {
    x: $var.default(0),
    y: $var.default(0),
    dist() {
      return Math.sqrt(this.x() ** 2 + this.y() ** 2);
    },
    translate({ _x = 0, _y = 0 }) {
      this.x(this.x() + _x);
      this.y(this.y() + _y);
      return this;
    }
  }
});

test('point', () => {
  assert.is($point.new({ _x: 3, _y: 4 }).dist(), 5);
  let t = $point.new();
  t.translate({ _x: 3, _y: 4 });
  assert.is(t.dist(), 5);
  assert.is($point.new().dist(), 0);

  const $loc_test = $class.new({
    _name: $$`loc_test`,
    _slots: {
      p: $var.new({
        default: () => $point.new()
      }),
      move() {
        this.p().translate({ _x: 1 });
      },
      dist() {
        return this.p().dist();
      }
    }
  });

  let l1 = $loc_test.new();
  let l2 = $loc_test.new();
  l1.move();
  l1.move();
  assert.is(l1.dist(), 2);
  assert.is(l2.dist(), 0);
});

test('mixins', () => {
  let $color_mixin = $mixin.new({
    _name: $$`color-mixin`,
    _slots: {
      r: $var.default(0),
      g: $var.default(0),
      b: $var.default(0),
      format() {
        return `(${this.r()}, ${this.g()}, ${this.b()})`;
      },
    }
  });

  const $color_point = $class.new({
    _name: $$`color_point`,
    _mixins: [$color_mixin],
    _super: $point,
  });

  const p = $color_point.new({
    _x: 3,
    _y: 4,
    _g: 12,
    _b: 77
  });

  assert.is(p.dist(), 5);
  assert.is(p.format(), '(0, 12, 77)');
});

test('inheritance', () => {
  const $child_point = $class.new({
    _name: $$`child_point`,
    _super: $point,
    _slots: {
      dist() {
        // note baked in super class - can we fix this in a nice way?
        return $child_point.superslots().dist.apply(this) / 2;
      }
    }
  });

  assert.is($child_point.new({ _x: 3, _y: 4 }).dist(), 2.5);

  const $smaller_point = $class.new({
    _name: $$`smaller_point`,
    _super: $child_point,
    _slots: {
      dist() {
        return $smaller_point.superslots().dist.apply(this) / 5;
      }
    }
  });

  assert.is($smaller_point.new({ _x: 3, _y: 4 }).dist(), 0.5);
  assert.is($smaller_point.new().translate({ _x: 4, _y: 0 }).dist(), 0.4);

  const $tiny_point = $class.new({
    _name: $$`tiny_point`,
    _super: $smaller_point,
    _slots: {
      dist() {
        return $tiny_point.superslots().dist.apply(this) / 10;
      }
    }
  });

  assert.is($tiny_point.new({ _x: 3, _y: 4 }).dist(), 0.05);
});

test('symbols', () => {
  assert.is($$`test`.eq($$`test`), true);
  assert.is(`<${$$`test`}>`, '<test>');
  assert.is($point.name().eq($$`point`), true);
});

test('getters n setters', () => {
  let p = $point.new({
    _x: 6,
    _y: 7.5,
  });

  assert.is(p.x() * p.y(), 45);
  assert.is(p.y(10), 10);
  assert.is(p.x() * p.y(), 60);
})

test.run();
