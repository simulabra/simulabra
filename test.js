import bootstrap from './base.js';
var __ = bootstrap();
let base_mod = __.mod();
export default __.new_module({
  name: 'test',
  imports: [base_mod],
  on_load(_, $) {
    $.class.new({
      name: 'case',
      components: [
        $.deffed,
        $.method.new({
          name: 'run',
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
  },
});
