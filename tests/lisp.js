import bootstrap from '../base.js';
const __ = bootstrap();
import test_mod from '../test.js';
import lisp_mod from '../lisp2.js';
const base_mod = __.mod();

export default __.new_module({
  name: 'test-classes',
  imports: [base_mod, test_mod, lisp_mod],
  on_load(_, $) {
    $.case.new({
      name: 'lisp-basic-parse',
      do() {
        const source = '~point.new({ :x 3 :y 4 })';
        const reader = $.reader.from_source(source);
        let f = reader.read();
        this.assert_eq(source, f.print());
      }
    })
    $.case.new({
      name: 'lisp-basic-run',
      do() {
        const counter_mod = $.test_module.run(
          'basic',
          `
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

$.test(:test-counter [
  $.let(%c ~counter.new)
  %c.inc
  %c.inc
  .assert-eq(%c.count 2)
])
`
        );
        counter_mod?.run_tests();
      }
    })
    $.case.new({
      name: 'lisp-quasiquotes',
      do() {
        return;
        const ex = `
$(macro quickmeth [name args @forms]
  \`~method(new {
      :name ,%name
      :do [|%args ,%forms]
    })
)

~class(new {
  name :point
  components [
    ~var(new {
      :name :x
      :type !number
      :default 0
    })
    ~var(new {
      :name :y
      :type !number
      :default 0
    })
    ~method(new {
      :name :dist
      :args (!self)
      :ret !number
      :do [^.x.-(%it.x).pow(2).+(y.-(%it.y).pow(2)).sqrt]
    })
    $(quickmeth translate (other) [
      .x(.x.add(%other.x))
      .y(.y.add(%other.y))
    ])
  ]
})
~debug.log(~point.new({x 3 y 4}).dist(~point.new))

`;
        $.source_module.run('quasiquote', ex);
      }
    })
  },
});
