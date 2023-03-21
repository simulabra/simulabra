import bootstrap from '../base.js';
var __ = bootstrap();
import test_mod from '../test.js';
import lisp_mod from '../lisp2.js';
let base_mod = __.mod();
export default __.new_module({
  name: 'test-classes',
  imports: [base_mod, test_mod, lisp_mod],
  on_load(_, $) {
    $.case.new({
      name: 'lisp-basic',
      do() {
        const counter_mod = $.source_module.run(
          'basic',
          `
~class.new({
  :name :counter
  :components [
    ~var.new({ :name :count :default 0 })
    ~method.new({
      :name :inc
      :do $(do .count(.count.+(1)))
    })
  ]
})
`
        );
        const c = counter_mod.$().counter.new();
        c.inc();
        c.inc();
        this.assert_eq(c.count(), 2);
      }
    })
    $.case.new({
      name: 'lisp-quasiquotes',
      do() {
        return;
        const ex = `
$(macro quickmeth [name args @forms]
  \`~method(new {
      name ,%name
      do $(lambda ,%args ,%forms)
    })
)

~class(new {
  name :point
  components [
    ~var(new {
      name :x
      type !number
      default 0
    })
    ~var(new {
      name :y
      type !number
      default 0
    })
    ~method(new {
      name :dist
      args [!self]
      ret !number
      do $(do ^.(x)(sub %it(x))(pow 2 | add .(y | sub %it(y) | pow 2) | sqrt))
    })
    $(quickmeth translate [other]
      .(x .(x | add %other(x)))
      .(y .(y | add %other(y)))
    )
  ]
})
~debug(log ~point(new {x 3 y 4} | dist ~point(new)))

`;
        $.source_module.run('quasiquote', ex);
      }
    })
  },
});
