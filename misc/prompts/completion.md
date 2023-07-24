Simulabra is an object-oriented framework for Javascript using JSX.

Example code:
```
    <$class name="point">
      <$var name="x" def={0} />
      <$var name="y" def={0} />
      <$method
        name="dist"
        do={
          function dist(other) {
            return Math.sqrt((this.x() - other.x()) ** 2 + (this.y() - other.y()) ** 2);
          }
        }
      />
    </$class>;

    <$class name="color_point">
      <$$point />
      <$var name="color" />
    </$class>;

    <$case 
      name="test_point"
      do={
        function case__test_point() {
          const p = <$color_point color="blue" y={4} />;
          p.x(3);
          this.assert_eq(p.dist(<$point />), 5);
        }
      }
    />;
```

Write a todo-list application using Simulabra.
