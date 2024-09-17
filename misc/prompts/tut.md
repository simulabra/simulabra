Welcome to Simulabra!

Simulabra is an object-oriented framework and metasystem for Javascript. It has a class system that best resembles the Common Lisp Object System and Flavors. Classes and methods are defined in a declarative style, with inline docs and before/after method combination instead of calls to super. Included are a component library and other utilities for writing dynamic web applications.

```
// class definition
$.class.new({
  name: 'point',
  doc: 'a 2d point in Euclidean space', // brief functional purpose of the class
  slots: [ // slot system
    $.var.new({
      name: 'x',
      default: 0,
    }),
    $.var.new({
      name: 'y',
      default: 0,
    }),
    $.method.new({
      name: 'dist',
      doc: 'the distance to another point',
      do: function dist(other) {
        return Math.sqrt((this.x() - other.x())**2 + (this.y() - other.y())**2);
      }
    }),
  ]
});
```
Now we can use the class as demonstrated in this test case:
```
$.test_case.new({
  name: 'point dist basic',
  do: function test_case__point_dist_basic() {
    const p = $.point.new({
      x: 3,
      y: 4
    });
    this.assert_eq(p.dist($.point.new()), 5);
  },
});
```
