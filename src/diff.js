import { __, base } from './base.js';

export default await function (_, $, $$) {
  $$.Class.new({
    name: 'DiffOp',
    slots: [
      $$.Virtual.new({ name: 'lengthDelta' }),
      $$.Virtual.new({ name: 'apply' }),
      $$.Virtual.new({ name: 'inverse' }),
      $$.Virtual.new({ name: 'addToSummary' })
    ]
  });

  $$.Class.new({
    name: 'RetainOp',
    slots: [
      $.DiffOp,
      $$.Var.new({ name: 'count', required: true }),
      $$.Method.new({
        name: 'lengthDelta',
        do() {
          return 0;
        }
      }),
      $$.Method.new({
        name: 'apply',
        do(text, idx) {
          return {
            result: text.slice(idx, idx + this.count()),
            newIdx: idx + this.count()
          };
        }
      }),
      $$.Method.new({
        name: 'inverse',
        do(text, idx) {
          return $.RetainOp.new({ count: this.count() });
        }
      }),
      $$.Method.new({
        name: 'addToSummary',
        do(summary) {
          summary.retains += this.count();
        }
      })
    ]
  });

  $$.Class.new({
    name: 'InsertOp',
    slots: [
      $.DiffOp,
      $$.Var.new({ name: 'text', required: true }),
      $$.Method.new({
        name: 'lengthDelta',
        do() {
          return this.text().length;
        }
      }),
      $$.Method.new({
        name: 'apply',
        do(text, idx) {
          return {
            result: this.text(),
            newIdx: idx
          };
        }
      }),
      $$.Method.new({
        name: 'inverse',
        do(text, idx) {
          return $.DeleteOp.new({ count: this.text().length });
        }
      }),
      $$.Method.new({
        name: 'addToSummary',
        do(summary) {
          summary.insertions += this.text().length;
        }
      })
    ]
  });

  $$.Class.new({
    name: 'DeleteOp',
    slots: [
      $.DiffOp,
      $$.Var.new({ name: 'count', required: true }),
      $$.Method.new({
        name: 'lengthDelta',
        do() {
          return -this.count();
        }
      }),
      $$.Method.new({
        name: 'apply',
        do(text, idx) {
          return {
            result: '',
            newIdx: idx + this.count()
          };
        }
      }),
      $$.Method.new({
        name: 'inverse',
        do(text, idx) {
          const deletedText = text.slice(idx, idx + this.count());
          return $.InsertOp.new({ text: deletedText });
        }
      }),
      $$.Method.new({
        name: 'addToSummary',
        do(summary) {
          summary.deletions += this.count();
        }
      })
    ]
  });

  $$.Class.new({
    name: 'Patch',
    slots: [
      $$.Var.new({
        name: 'ops',
        default: () => []
      }),
      $$.Var.new({ name: 'sourceLength', default: 0 }),
      $$.Var.new({ name: 'targetLength', default: 0 }),
      $$.Method.new({
        name: 'apply',
        do(text) {
          let result = '';
          let idx = 0;

          for (const op of this.ops()) {
            const { result: opResult, newIdx } = op.apply(text, idx);
            result += opResult;
            idx = newIdx;
          }

          return result;
        }
      }),
      $$.Method.new({
        name: 'isEmpty',
        do() {
          return this.ops().every(op => op.class().name === 'RetainOp');
        }
      }),
      $$.Method.new({
        name: 'inverse',
        do(sourceText) {
          const inverseOps = [];
          let idx = 0;

          for (const op of this.ops()) {
            const inverseOp = op.inverse(sourceText, idx);
            inverseOps.push(inverseOp);
            const { newIdx } = op.apply(sourceText, idx);
            idx = newIdx;
          }

          return $.Patch.new({
            ops: inverseOps,
            sourceLength: this.targetLength(),
            targetLength: this.sourceLength()
          });
        }
      }),
      $$.Method.new({
        name: 'summary',
        do() {
          const summary = {
            insertions: 0,
            deletions: 0,
            retains: 0,
            opCount: this.ops().length
          };

          for (const op of this.ops()) {
            op.addToSummary(summary);
          }

          return summary;
        }
      })
    ]
  });

  $$.Class.new({
    name: 'DiffEngine',
    slots: [
      $$.Static.new({
        name: 'computePatch',
        do(oldText, newText) {
          const ops = [];

          const m = oldText.length;
          const n = newText.length;

          const lcs = this.longestCommonSubsequence(oldText, newText);

          let i = 0;
          let j = 0;
          let lcsIdx = 0;

          while (i < m || j < n) {
            if (lcsIdx < lcs.length &&
                i === lcs[lcsIdx].i &&
                j === lcs[lcsIdx].j) {
              const retainStart = i;
              while (lcsIdx < lcs.length &&
                     i === lcs[lcsIdx].i &&
                     j === lcs[lcsIdx].j) {
                i++;
                j++;
                lcsIdx++;
              }
              ops.push($.RetainOp.new({
                count: i - retainStart
              }));
            } else if (lcsIdx < lcs.length) {
              const nextLcsI = lcs[lcsIdx].i;
              const nextLcsJ = lcs[lcsIdx].j;

              const deleteCount = nextLcsI - i;
              const insertText = newText.slice(j, nextLcsJ);

              if (deleteCount > 0) {
                ops.push($.DeleteOp.new({
                  count: deleteCount
                }));
                i = nextLcsI;
              }

              if (insertText.length > 0) {
                ops.push($.InsertOp.new({
                  text: insertText
                }));
                j = nextLcsJ;
              }
            } else {
              if (i < m) {
                ops.push($.DeleteOp.new({
                  count: m - i
                }));
                i = m;
              }
              if (j < n) {
                ops.push($.InsertOp.new({
                  text: newText.slice(j)
                }));
                j = n;
              }
            }
          }

          return $.Patch.new({
            ops,
            sourceLength: m,
            targetLength: n
          });
        }
      }),
      $$.Static.new({
        name: 'longestCommonSubsequence',
        do(str1, str2) {
          const m = str1.length;
          const n = str2.length;

          const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

          for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
              if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
              } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
              }
            }
          }

          const lcs = [];
          let i = m;
          let j = n;

          while (i > 0 && j > 0) {
            if (str1[i - 1] === str2[j - 1]) {
              lcs.unshift({ i: i - 1, j: j - 1 });
              i--;
              j--;
            } else if (dp[i - 1][j] > dp[i][j - 1]) {
              i--;
            } else {
              j--;
            }
          }

          return lcs;
        }
      })
    ]
  });

  $$.Class.new({
    name: 'Revision',
    slots: [
      $$.Var.new({ name: 'revisionId' }),
      $$.Var.new({ name: 'repo' }),
      $$.Var.new({ name: 'parentIds', default: () => [] }),
      $$.Var.new({ name: 'patchFromParent', default: null }),
      $$.Var.new({ name: 'snapshot', default: '' }),
      $$.Var.new({ name: 'message', default: '' }),
      $$.Var.new({ name: 'createdAt', default: () => Date.now() }),
      $$.Method.new({
        name: 'text',
        do() {
          return this.snapshot();
        }
      }),
      $$.Method.new({
        name: 'parents',
        do() {
          return this.parentIds().map(pid => this.repo().getRevision(pid));
        }
      }),
      $$.Method.new({
        name: 'children',
        do() {
          return this.repo().getChildren(this.revisionId());
        }
      }),
      $$.Method.new({
        name: 'summary',
        do() {
          if (!this.patchFromParent()) {
            return 'initial revision';
          }
          const s = this.patchFromParent().summary();
          const parts = [];
          if (s.insertions > 0) parts.push(`+${s.insertions}`);
          if (s.deletions > 0) parts.push(`-${s.deletions}`);
          return parts.length > 0 ? parts.join(' ') : 'no changes';
        }
      })
    ]
  });

  $$.Class.new({
    name: 'TextRepo',
    slots: [
      $$.Var.new({ name: 'root', default: null }),
      $$.Var.new({
        name: 'revisions',
        default: () => new Map()
      }),
      $$.Var.new({
        name: 'heads',
        default: () => new Map()
      }),
      $$.Method.new({
        name: 'initSeed',
        do(text = '') {
          const root = $.Revision.new({
            revisionId: 0,
            repo: this,
            snapshot: text,
            message: 'initial',
            parentIds: []
          });
          this.root(root);
          this.revisions().set(0, root);
          return root;
        }
      }),
      $$.Method.new({
        name: 'commit',
        do(currentRevision, newText, message = '') {
          const oldText = currentRevision ? currentRevision.snapshot() : '';
          const patch = $.DiffEngine.computePatch(oldText, newText);

          const newId = this.revisions().size;
          const parentIds = currentRevision ? [currentRevision.revisionId()] : [];

          const revision = $.Revision.new({
            revisionId: newId,
            repo: this,
            parentIds,
            patchFromParent: patch,
            snapshot: newText,
            message,
            createdAt: Date.now()
          });

          this.revisions().set(newId, revision);
          return revision;
        }
      }),
      $$.Method.new({
        name: 'getRevision',
        do(id) {
          return this.revisions().get(id);
        }
      }),
      $$.Method.new({
        name: 'getChildren',
        do(parentId) {
          const children = [];
          for (const [id, rev] of this.revisions()) {
            if (rev.parentIds().includes(parentId)) {
              children.push(rev);
            }
          }
          return children;
        }
      }),
      $$.Method.new({
        name: 'pathTo',
        do(revision) {
          const path = [];
          let current = revision;

          while (current) {
            path.unshift(current);
            const parents = current.parents();
            current = parents.length > 0 ? parents[0] : null;
          }

          return path;
        }
      }),
      $$.Method.new({
        name: 'diffBetween',
        do(revA, revB) {
          return $.DiffEngine.computePatch(revA.snapshot(), revB.snapshot());
        }
      })
    ]
  });
}.module({
  name: 'diff',
  imports: [base],
}).load();
