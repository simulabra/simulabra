var __ = globalThis.SIMULABRA;
var _ = __.mod().find('class', 'module').new({
  name: '${this.name()}',
  imports: [__.mod()],
});
__.mod(_);
var $ = _.proxy('class');

$.class.new({
  name: 'renderer',
  components: [
    $.var.new({
      name: 'canvas',
      debug: false,
    }),
    function ctx() {
      return this.canvas().getContext('2d');
    },
    $.var.new({ name: 'scale', default: 10 }),
    $.after.new({
      name: 'init',
      do() {
        this.canvas();
        this.ctx();
      }
    }),
    function render(obj) {
      this.ctx()[obj.draw_method()](...obj.draw_args());
    },
    function translate(point) {
    },
  ]
});

$.class.new({
  name: 'point',
  components: [
    $.var.new({ name: 'x', default: 0 }),
    $.var.new({ name: 'y', default: 0 }),
  ]
});

$.class.new({
  name: 'rect',
  components: [
    $.var.new({ name: 'p1' }),
    $.var.new({ name: 'p2' }),
    $.var.new({ name: 'fill', default: true }),
    function draw_method(r) {
      if (this.fill()) {
        return 'fillRect';
      } else {
        return 'strokeRect';
      }
    },
    function draw_args(r) {
      return [this.p1().x(), this.p1().y(), this.p2().x() - this.p1().x(), this.p2().y() - this.p1().y()];
    },
  ]
});

$.class.new({
  name: 'circle',
  components: [
    $.var.new({ name: 'center' }),
    $.var.new({ name: 'radius' }),
    $.var.new({ name: 'fill', default: true }),
    function draw_method(r) {
      if (this.fill()) {
        return 'fillCircle';
      } else {
        return 'strokeCircle';
      }
    },

  ]
})

window.addEventListener('load', e => {

  console.log(document.getElementById('root'));
  const renderer = $.renderer.new({ canvas: document.getElementById("root") });
  renderer.render($.rect.new({
    p1: $.point.new({ x: 10, y: 10 }),
    p2: $.point.new({ x: 50, y: 50 }),
    fill: true,
  }));
});
