import bootstrap from '../base.js';
const __ = bootstrap();
import test_mod from '../test.js';
import lisp_mod from '../lisp2.js';
const base_mod = __.base();

export default await base_mod.find('class', 'module').new({
  name: 'test-lisp',
  imports: [base_mod, test_mod, lisp_mod],
  async on_load(_, $) {
    $.case.new({
      name: 'lisp-basic-parse',
      do() {
        const source = '~point.new({ :x 3 :y 4 })';
        const reader = $.reader.from_source(source);
        let f = reader.read();
        this.assert_eq(source, f.print());
      }
    });

    $.case.new({
      name: 'lisp-basic-run',
      async do() {
        const transformer = $.transformer.new();
        const counter_mod = await $.script.new({
          name: 'lisp-basic-run--counter',
          imports: [_],
          source: `
~class.new({
  :name :counter
  :components (
    ~var.new({ :name :count :default 0 })
    ~method.new({
      :name :inc
      :do [.count(.count.+(1))]
    })
  )
})
`,
        }).run(transformer);
        const c = counter_mod.find('class', 'counter').new();
        c.inc();
        c.inc();
        this.assert_eq(c.count(), 2);
      }
    });
  },
}).load();
