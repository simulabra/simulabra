import { __, base } from '../src/base.js';
import test from '../src/test.js';

export default await async function (_, $, $test) {
  $.Class.new({
    name: 'TotallyReal',
    slots: [
      $.Var.new({ name: 'existence', default: true }),
      $.Var.new({ name: 'confidence', default: 100 }),
      $.Var.new({ name: 'contents', default: () => [] }),
      $.Method.new({
        name: 'doubt',
        do() {
          if (this.confidence() <= 0) throw new Error('Existential crisis!');
          this.confidence(this.confidence() - 25);
          return this.confidence();
        }
      }),
      $.Method.new({
        name: 'acquire',
        do(thing) { this.contents().push(thing); }
      })
    ]
  });

  $test.Case.new({
    name: 'SanityCheck',
    doc: 'Things that exist have confidence.',
    do() {
      const thing = _.TotallyReal.new({ name: 'Thing' });

      this.assert(thing.existence(), 'Thing exists');
      this.assertEq(thing.confidence(), 100, 'Full confidence');
      this.assertEq(thing.doubt(), 75, 'Doubt reduces confidence');
      this.assertEq(thing.doubt(), 50, 'More doubt');
    }
  });

  $test.Case.new({
    name: 'IndependentReality',
    doc: 'Each instance has its own contents.',
    do() {
      const a = _.TotallyReal.new({ name: 'A' });
      const b = _.TotallyReal.new({ name: 'B' });

      a.acquire('notion');
      a.acquire('vibe');
      b.acquire('concept');

      this.assertEq(a.contents().length, 2);
      this.assertEq(b.contents().length, 1);
      this.assert(a.contents() !== b.contents(), 'Separate realities');
    }
  });

  $test.Case.new({
    name: 'ExistentialCrisis',
    doc: 'Too much doubt causes problems.',
    do() {
      const fragile = _.TotallyReal.new({ name: 'Fragile', confidence: 0 });

      const error = this.assertThrows(
        () => fragile.doubt(),
        'Existential crisis',
        'Cannot doubt with no confidence'
      );
      this.assertErrorMessageIncludes(error, 'crisis');
    }
  });

  $test.AsyncCase.new({
    name: 'TimeHealsAllDoubts',
    doc: 'Async test: confidence can be restored.',
    async do() {
      const recovering = _.TotallyReal.new({ name: 'Recovering', confidence: 30 });

      await __.sleep(5);
      recovering.confidence(recovering.confidence() + 50);

      this.assertEq(recovering.confidence(), 80, 'Confidence restored');
    }
  });

}.module({
  name: 'test.simple',
  imports: [base, test],
}).load();
