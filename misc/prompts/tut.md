##### Introducing SIMULABRA: infinite software.
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

Simulabra is an object-oriented extension for Javascript. The class system (which does not use the ES5 `class` keyword) best resembles the Common Lisp Object System (specifically the original Flavors, without multiple dispatch). Classes are defined in a declarative style, with slots of methods, vars, and before/after method combination instead of `super`; docstrings; and multiple inheritance, differentiating it from contemporary takes on OOP. Included are a component library and other utilities for writing dynamic web applications.

##### A guide to writing Simulabra
 - Be consistent with naming  - do not use overly short names in public interfaces. 
 - Only add comments when they are necessary, prefer doc strings and readable code.
 - The shortest solution is generally best, but it is most important to handle complexity. 
 - Consider different approaches and tradeoffs when encountering difficult problems. 
 - Try to always do things the Simulabra way, in style and idiom.  
