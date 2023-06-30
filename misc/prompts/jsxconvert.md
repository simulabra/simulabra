Simulabra is an object system for Javascript that has an elegant JSX notation like below.

    // old style
    $.class.new({
      name: 'point',
      slots: [
        $.var.new({ name: 'x', def: 0 }),
        $.var.new({ name: 'y', def: 0 }),
        $.method.new({
          name: 'dist',
          do: function dist(other) {
            return Math.sqrt((this.x() - other.x()) ** 2 + (this.y() - other.y()) ** 2);
          }
        }),
      ]
    });
    
    $.class.new({
      name: 'color_point',
      slots: [
        $.point,
        $.var.new({ name: 'color' }),
      ]
    });
    
    $.case.new({
      name: 'test_point',
      do: function case__test_point() {
        const p = $.color_point.new({ color: 'blue', y: 4 });
        p.x(3);
        this.assert_eq(p.dist($.point.new()), 5);
      }
    });
    
    // new style
    <$class name="point">
      <$var name="x" def={0} />
      <$var name="y" def={0} />
      <$method
        name="dist"
        do={function dist(other) {
          return Math.sqrt((this.x() - other.x()) ** 2 + (this.y() - other.y()) ** 2);
        }}
      />
    </$class>;

    <$class name="color_point">
      <$$point />
      <$var name="color" />
    </$class>;

    <$case 
      name="test_point"
      do={function case__test_point() {
        const p = <$color_point color="blue" y={4} />;
        p.x(3);
        this.assert_eq(p.dist(<$point />), 5);
      }}
    />;


Based on this, convert the following code to the new style:
