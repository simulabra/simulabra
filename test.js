export default function() {
  var __ = globalThis.SIMULABRA;
  let base_mod = __.mod();
  const _ = __.mod().find('class', 'module').new({
    name: 'test',
    imports: [base_mod],
  });
  const $ = _.proxy('class');

  $.class.new({
    name: 'case',
    components: [
      $.after.new({
        name: 'init',
        do() {
          try {
            this.do().apply(this);
          } catch (e) {
            this.log('failed!!!');
            throw e;
          }
          this.log('passed');
        }
      }),
      $.var.new({ name: 'do' }),
      $.method.new({
        name: 'assert-eq',
        do(a, b) {
          if (a !== b) {
            throw new Error(`assertion failed: ${a.description()} !== ${b.description()}`);
          }
        }
      })
    ]
  });
};
