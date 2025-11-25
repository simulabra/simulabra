import { __, base } from '../src/base.js';
import test from '../src/test.js';
import diff from '../src/diff.js';

export default await async function (_, $, $base, $test, $diff) {
  $test.Case.new({
    name: 'RetainOp',
    do() {
      const op = $diff.RetainOp.new({
        count: 5
      });
      this.assertEq(op.count(), 5);
      this.assertEq(op.lengthDelta(), 0);
    }
  });

  $test.Case.new({
    name: 'InsertOp',
    do() {
      const op = $diff.InsertOp.new({
        text: 'hello'
      });
      this.assertEq(op.text(), 'hello');
      this.assertEq(op.lengthDelta(), 5);
    }
  });

  $test.Case.new({
    name: 'DeleteOp',
    do() {
      const op = $diff.DeleteOp.new({
        count: 3
      });
      this.assertEq(op.count(), 3);
      this.assertEq(op.lengthDelta(), -3);
    }
  });

  $test.Case.new({
    name: 'PatchApplyIdentity',
    do() {
      const text = 'hello world';
      const patch = $diff.Patch.new({
        ops: [
          $diff.RetainOp.new({ count: text.length })
        ],
        sourceLength: text.length,
        targetLength: text.length
      });
      const result = patch.apply(text);
      this.assertEq(result, text);
    }
  });

  $test.Case.new({
    name: 'PatchApplySimpleInsert',
    do() {
      const text = 'hello';
      const patch = $diff.Patch.new({
        ops: [
          $diff.RetainOp.new({ count: 5 }),
          $diff.InsertOp.new({ text: ' world' })
        ],
        sourceLength: 5,
        targetLength: 11
      });
      const result = patch.apply(text);
      this.assertEq(result, 'hello world');
    }
  });

  $test.Case.new({
    name: 'PatchApplySimpleDelete',
    do() {
      const text = 'hello world';
      const patch = $diff.Patch.new({
        ops: [
          $diff.RetainOp.new({ count: 5 }),
          $diff.DeleteOp.new({ count: 6 })
        ],
        sourceLength: 11,
        targetLength: 5
      });
      const result = patch.apply(text);
      this.assertEq(result, 'hello');
    }
  });

  $test.Case.new({
    name: 'PatchApplyReplace',
    do() {
      const text = 'hello world';
      const patch = $diff.Patch.new({
        ops: [
          $diff.RetainOp.new({ count: 6 }),
          $diff.DeleteOp.new({ count: 5 }),
          $diff.InsertOp.new({ text: 'there' })
        ],
        sourceLength: 11,
        targetLength: 11
      });
      const result = patch.apply(text);
      this.assertEq(result, 'hello there');
    }
  });

  $test.Case.new({
    name: 'DiffEngineIdentical',
    do() {
      const text = 'hello';
      const patch = $diff.DiffEngine.computePatch(text, text);
      this.assertEq(patch.sourceLength(), 5);
      this.assertEq(patch.targetLength(), 5);
      this.assert(patch.isEmpty());
      const result = patch.apply(text);
      this.assertEq(result, text);
    }
  });

  $test.Case.new({
    name: 'DiffEngineSimpleAppend',
    do() {
      const oldText = 'hello';
      const newText = 'hello world';
      const patch = $diff.DiffEngine.computePatch(oldText, newText);
      const result = patch.apply(oldText);
      this.assertEq(result, newText);
    }
  });

  $test.Case.new({
    name: 'DiffEngineSimpleDelete',
    do() {
      const oldText = 'hello world';
      const newText = 'hello';
      const patch = $diff.DiffEngine.computePatch(oldText, newText);
      const result = patch.apply(oldText);
      this.assertEq(result, newText);
    }
  });

  $test.Case.new({
    name: 'DiffEngineSimpleReplace',
    do() {
      const oldText = 'hello world';
      const newText = 'hello there';
      const patch = $diff.DiffEngine.computePatch(oldText, newText);
      const result = patch.apply(oldText);
      this.assertEq(result, newText);
    }
  });

  $test.Case.new({
    name: 'DiffEngineCompleteRewrite',
    do() {
      const oldText = 'abc';
      const newText = 'xyz';
      const patch = $diff.DiffEngine.computePatch(oldText, newText);
      const result = patch.apply(oldText);
      this.assertEq(result, newText);
    }
  });

  $test.Case.new({
    name: 'DiffEngineEmptyStrings',
    do() {
      const patch = $diff.DiffEngine.computePatch('', '');
      this.assert(patch.isEmpty());
      this.assertEq(patch.apply(''), '');
    }
  });

  $test.Case.new({
    name: 'DiffEngineEmptyToText',
    do() {
      const newText = 'hello';
      const patch = $diff.DiffEngine.computePatch('', newText);
      const result = patch.apply('');
      this.assertEq(result, newText);
    }
  });

  $test.Case.new({
    name: 'DiffEngineTextToEmpty',
    do() {
      const oldText = 'hello';
      const patch = $diff.DiffEngine.computePatch(oldText, '');
      const result = patch.apply(oldText);
      this.assertEq(result, '');
    }
  });

  $test.Case.new({
    name: 'DiffEngineMiddleInsert',
    do() {
      const oldText = 'helo';
      const newText = 'hello';
      const patch = $diff.DiffEngine.computePatch(oldText, newText);
      const result = patch.apply(oldText);
      this.assertEq(result, newText);
    }
  });

  $test.Case.new({
    name: 'DiffEngineMultipleChanges',
    do() {
      const oldText = 'The quick fox';
      const newText = 'The quick brown fox jumps';
      const patch = $diff.DiffEngine.computePatch(oldText, newText);
      const result = patch.apply(oldText);
      this.assertEq(result, newText);
    }
  });

  $test.Case.new({
    name: 'PatchInverseSimple',
    do() {
      const oldText = 'hello';
      const newText = 'hello world';
      const patch = $diff.DiffEngine.computePatch(oldText, newText);
      const inverse = patch.inverse(oldText);
      const result = inverse.apply(newText);
      this.assertEq(result, oldText);
    }
  });

  $test.Case.new({
    name: 'PatchInverseWithDelete',
    do() {
      const oldText = 'hello world';
      const newText = 'hello';
      const patch = $diff.DiffEngine.computePatch(oldText, newText);
      const inverse = patch.inverse(oldText);
      const result = inverse.apply(newText);
      this.assertEq(result, oldText);
    }
  });

  $test.Case.new({
    name: 'PatchInverseReplace',
    do() {
      const oldText = 'hello world';
      const newText = 'hello there';
      const patch = $diff.DiffEngine.computePatch(oldText, newText);
      const inverse = patch.inverse(oldText);
      const result = inverse.apply(newText);
      this.assertEq(result, oldText);
    }
  });

  $test.Case.new({
    name: 'PatchSummaryBasic',
    do() {
      const oldText = 'hello';
      const newText = 'hello world';
      const patch = $diff.DiffEngine.computePatch(oldText, newText);
      const summary = patch.summary();
      this.assertEq(summary.insertions, 6);
      this.assertEq(summary.deletions, 0);
      this.assertEq(summary.retains, 5);
    }
  });

  $test.Case.new({
    name: 'PatchSummaryWithDelete',
    do() {
      const oldText = 'hello world';
      const newText = 'hello';
      const patch = $diff.DiffEngine.computePatch(oldText, newText);
      const summary = patch.summary();
      this.assertEq(summary.insertions, 0);
      this.assertEq(summary.deletions, 6);
      this.assertEq(summary.retains, 5);
    }
  });

  $test.Case.new({
    name: 'PatchSummaryReplace',
    do() {
      const oldText = 'hello world';
      const newText = 'hello there';
      const patch = $diff.DiffEngine.computePatch(oldText, newText);
      const summary = patch.summary();
      this.assertEq(summary.insertions, 4);
      this.assertEq(summary.deletions, 4);
      this.assertEq(summary.retains, 7);
    }
  });

  $test.Case.new({
    name: 'TextRepoInitSeed',
    do() {
      const repo = $diff.TextRepo.new();
      const root = repo.initSeed('hello');
      this.assertEq(root.text(), 'hello');
      this.assertEq(root.revisionId(), 0);
      this.assertEq(root.parentIds().length, 0);
      this.assertEq(root.message(), 'initial');
    }
  });

  $test.Case.new({
    name: 'TextRepoLinearCommits',
    do() {
      const repo = $diff.TextRepo.new();
      const r0 = repo.initSeed('hello');
      const r1 = repo.commit(r0, 'hello world', 'add world');
      const r2 = repo.commit(r1, 'hello there', 'change to there');

      this.assertEq(r1.text(), 'hello world');
      this.assertEq(r2.text(), 'hello there');
      this.assertEq(r1.parentIds()[0], 0);
      this.assertEq(r2.parentIds()[0], 1);
    }
  });

  $test.Case.new({
    name: 'RevisionParents',
    do() {
      const repo = $diff.TextRepo.new();
      const r0 = repo.initSeed('hello');
      const r1 = repo.commit(r0, 'hello world', 'add world');

      const parents = r1.parents();
      this.assertEq(parents.length, 1);
      this.assertEq(parents[0].revisionId(), 0);
      this.assertEq(parents[0].text(), 'hello');
    }
  });

  $test.Case.new({
    name: 'RevisionChildren',
    do() {
      const repo = $diff.TextRepo.new();
      const r0 = repo.initSeed('hello');
      const r1 = repo.commit(r0, 'hello world', 'add world');
      const r2 = repo.commit(r0, 'hello there', 'branch from r0');

      const children = r0.children();
      this.assertEq(children.length, 2);
      this.assert(children.some(c => c.revisionId() === 1));
      this.assert(children.some(c => c.revisionId() === 2));
    }
  });

  $test.Case.new({
    name: 'TextRepoPathTo',
    do() {
      const repo = $diff.TextRepo.new();
      const r0 = repo.initSeed('a');
      const r1 = repo.commit(r0, 'ab', 'add b');
      const r2 = repo.commit(r1, 'abc', 'add c');

      const path = repo.pathTo(r2);
      this.assertEq(path.length, 3);
      this.assertEq(path[0].revisionId(), 0);
      this.assertEq(path[1].revisionId(), 1);
      this.assertEq(path[2].revisionId(), 2);
    }
  });

  $test.Case.new({
    name: 'TextRepoDiffBetween',
    do() {
      const repo = $diff.TextRepo.new();
      const r0 = repo.initSeed('hello');
      const r1 = repo.commit(r0, 'hello world', 'add world');

      const patch = repo.diffBetween(r0, r1);
      const result = patch.apply(r0.text());
      this.assertEq(result, r1.text());
    }
  });

  $test.Case.new({
    name: 'RevisionSummary',
    do() {
      const repo = $diff.TextRepo.new();
      const r0 = repo.initSeed('hello');
      const r1 = repo.commit(r0, 'hello world', 'add world');

      this.assertEq(r0.summary(), 'initial revision');
      this.assert(r1.summary().includes('+'));
    }
  });
}.module({
  name: 'test.diff',
  imports: [base, test, diff],
}).load();
