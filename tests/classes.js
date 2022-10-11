import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { oClass } from '../smoperat.js';

test('classes', () => {
  let Point = oClass.new({
    name: 'Point',
    vars: {
      x: 0,
      y: 0
    },

    methods: {
      dist() {
        return Math.sqrt(this._.x ** 2 + this._.y ** 2);
      },
      translate({ x = 0, y = 0 }) {
        this._.x += x;
        this._.y += y;
      }
    }
  })

  console.log(Point.new({ x: 2, y: 3 }).dist());
  let t = Point.new();
  t.translate({ x: 3, y: 4 });
  assert.is(t.dist(), 5);
  assert.is(Point.new().dist(), 0);

  let LocTest = oClass.new({
    name: 'LocTest',
    vars: {
      p: () => Point.new(),
    },
    methods: {
      move() {
        this._.p.translate({ x: 1 });
      },
      dist() {
        return this._.p.dist();
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

test.run();
