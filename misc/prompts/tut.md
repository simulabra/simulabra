Welcome to Simulabra!

Simulabra is an object-oriented extension for Javascript. The class system (which does not use the ES5 `class` keyword) best resembles the Common Lisp Object System (specifically the original Flavors, without multiple dispatch). Classes are defined in a declarative style, with slots of methods, vars, and before/after method combination instead of `super`; docstrings; and multiple inheritance, differentiating it from contemporary takes on OOP. Included are a component library and other utilities for writing dynamic web applications.

Here is how you define a class in Simulabra.
```
$.Class.new({
  name: 'Point',
  doc: 'a 2d point in Euclidean space',
  slots: [
    $.Var.new({
      name: 'x',
      default: 0,
    }),
    $.Var.new({
      name: 'y',
      default: 0,
    }),
    $.Method.new({
      name: 'dist',
      doc: 'the distance to another point',
      do: function dist(other) {
        return Math.sqrt((this.x() - other.x())**2 + (this.y() - other.y())**2);
      },
    }),
  ],
});
```
Now we can use the class as demonstrated in this test case.
```
$.TestCase.new({
  name: 'PointBasic',
  do: function TestCase__PointBasic() {
    const p = $.Point.new({
      x: 3,
      y: 4
    });
    this.assertEq(p.dist($.Point.new()), 5);
  },
});
```
Be consistent with naming conventions and keep them general. Do not add comments unless they are necessary. The shortest solution is generally best. Consider different approaches and tradeoffs.
