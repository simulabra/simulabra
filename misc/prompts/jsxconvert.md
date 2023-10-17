Simulabra is an object-oriented extension of Javascript.

```
// old style
$.class.new({
 name: 'point',
 slots: [
  $.var.new({ name: 'x', default: 0 }),
  $.var.new({ name: 'y', default: 0 }),
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
  $.method.new({
   name: 'render',
   do: function render() {
    return $.el('div', { style: `color: ${this.color().css()}` }, '(', $.el('span', {}, this.x()), ',', $.el('span', {}, this.y()), ')');
   }
  }),
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
 <$var name="x" default={0} />
 <$var name="y" default={0} />
 <$method name="dist">{
  function dist(other) {
   return Math.sqrt((this.x() - other.x()) ** 2 + (this.y() - other.y()) ** 2);
  }
 }</$method>
</$class>;

<$class name="color_point">
 <$$point />
 <$var name="color" />
 <$method name="render">{
  function render() {
   return <div style={`color: ${this.color().css()}`}>({this.x()}, {this.y()})</div>
  }
 }</$method>
</$class>;

<$case name="test_point">{
 function case__test_point() {
  const p = <$color_point color="blue" y={4} />;
  p.x(3);
  this.assert_eq(p.dist(<$point />), 5);
 }
}</$case>;
```


Based on this, convert the following code to the old style. Do not skip any methods or lines:
