### SIMULABRA

Simulabra is a metaobject system for Javascript. It has an extensible slot system that powers builtin signals and commands; a reactive HTML templating system for dynamic web applications; before/after method combination and multiple inheritance; and a batteries-included mentality to standard library design. 

For a fuller tour of its features, read through `tests/core.js` and `demos/loom.js`.


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
      do(other) {
        return Math.sqrt((this.x() - other.x())**2 + (this.y() - other.y())**2);
      },
    }),
  ],
});

$.Point.new({ x: 3, y: 4 }).dist($.Point.new()) // 5
```

To run locally, install Bun first, then run:
``` sh
bun install
./serve.sh
```
Then navigate to e.g. http://localhost:8080/loom
