import base from '../base.js';
import test from '../test.js';
import lang from '../lang.js';
const __ = globalThis.SIMULABRA;

export default await base.find('class', 'module').new({
  name: 'test-lisp',
  imports: [base, test, lang],
  async on_load(_, $) {
    $.case.new({
      name: 'lisp-basic-parse',
      do() {
        const source = `~point.new{
  :x=3
  :y=%wob.frob(1 2)
  :change=$.do(.x(.x.add(.y)))
}`;
        const reader = $.reader.from_source(source);
        let f = reader.read();
        this.assert_eq(source, f.print());
      }
    });

    $.case.new({
      name: 'lisp-basic-run',
      async do() {
        const transformer = $.transformer.new();
        transformer.module_cache($.module_cache.new());
        const counter_mod = await $.script.new({
          name: 'lisp-basic-run--counter',
          imports: [_],
          source: `
~class.new{
  :name=:counter
  :components=(
    ~var.new{:name=:count :default=0}
    ~method.new{
      :name=:inc
      :do=[.count(.count.add(1))]
    }
  )
}
`,
        }).run(transformer);

        const $counter = counter_mod.find('class', 'counter');
        const c = $counter.new();
        c.inc();
        c.inc();
        this.assert_eq($counter.new().id(), 1);
        this.assert_eq(c.count(), 2);
      }
    });
  },
}).load();
