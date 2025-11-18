import { __, base } from './base.js';

export default await function (_, $, $base) {
  $base.Class.new({
    name: 'DiffOp',
    slots: [
      $base.EnumVar.new({
        name: 'kind',
        choices: ['retain', 'insert', 'delete'],
        required: true
      }),
      $base.Var.new({ name: 'count', default: 0 }),
      $base.Var.new({ name: 'text', default: '' }),
      $base.Method.new({
        name: 'lengthDelta',
        do() {
          if (this.kind() === 'insert') {
            return this.text().length;
          } else if (this.kind() === 'delete') {
            return -this.count();
          } else {
            return 0;
          }
        }
      }),
      $base.Method.new({
        name: 'inverse',
        do() {
          if (this.kind() === 'insert') {
            return $.DiffOp.new({
              kind: 'delete',
              count: this.text().length
            });
          } else if (this.kind() === 'delete') {
            throw new Error('Cannot invert delete without original text');
          } else {
            return $.DiffOp.new({
              kind: 'retain',
              count: this.count()
            });
          }
        }
      })
    ]
  });

  $base.Class.new({
    name: 'Patch',
    slots: [
      $base.Var.new({
        name: 'ops',
        default: () => []
      }),
      $base.Var.new({ name: 'sourceLength', default: 0 }),
      $base.Var.new({ name: 'targetLength', default: 0 }),
      $base.Method.new({
        name: 'apply',
        do(text) {
          let result = '';
          let idx = 0;

          for (const op of this.ops()) {
            if (op.kind() === 'retain') {
              result += text.slice(idx, idx + op.count());
              idx += op.count();
            } else if (op.kind() === 'delete') {
              idx += op.count();
            } else if (op.kind() === 'insert') {
              result += op.text();
            }
          }

          return result;
        }
      }),
      $base.Method.new({
        name: 'isEmpty',
        do() {
          return this.ops().every(op => op.kind() === 'retain');
        }
      }),
      $base.Method.new({
        name: 'inverse',
        do(sourceText) {
          const inverseOps = [];
          let idx = 0;

          for (const op of this.ops()) {
            if (op.kind() === 'retain') {
              inverseOps.push($.DiffOp.new({
                kind: 'retain',
                count: op.count()
              }));
              idx += op.count();
            } else if (op.kind() === 'delete') {
              const deletedText = sourceText.slice(idx, idx + op.count());
              inverseOps.push($.DiffOp.new({
                kind: 'insert',
                text: deletedText
              }));
              idx += op.count();
            } else if (op.kind() === 'insert') {
              inverseOps.push($.DiffOp.new({
                kind: 'delete',
                count: op.text().length
              }));
            }
          }

          return $.Patch.new({
            ops: inverseOps,
            sourceLength: this.targetLength(),
            targetLength: this.sourceLength()
          });
        }
      }),
      $base.Method.new({
        name: 'summary',
        do() {
          let insertions = 0;
          let deletions = 0;
          let retains = 0;

          for (const op of this.ops()) {
            if (op.kind() === 'insert') {
              insertions += op.text().length;
            } else if (op.kind() === 'delete') {
              deletions += op.count();
            } else if (op.kind() === 'retain') {
              retains += op.count();
            }
          }

          return {
            insertions,
            deletions,
            retains,
            opCount: this.ops().length
          };
        }
      })
    ]
  });

  $base.Class.new({
    name: 'DiffEngine',
    slots: [
      $base.Static.new({
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
              ops.push($.DiffOp.new({
                kind: 'retain',
                count: i - retainStart
              }));
            } else if (lcsIdx < lcs.length) {
              const nextLcsI = lcs[lcsIdx].i;
              const nextLcsJ = lcs[lcsIdx].j;

              const deleteCount = nextLcsI - i;
              const insertText = newText.slice(j, nextLcsJ);

              if (deleteCount > 0) {
                ops.push($.DiffOp.new({
                  kind: 'delete',
                  count: deleteCount
                }));
                i = nextLcsI;
              }

              if (insertText.length > 0) {
                ops.push($.DiffOp.new({
                  kind: 'insert',
                  text: insertText
                }));
                j = nextLcsJ;
              }
            } else {
              if (i < m) {
                ops.push($.DiffOp.new({
                  kind: 'delete',
                  count: m - i
                }));
                i = m;
              }
              if (j < n) {
                ops.push($.DiffOp.new({
                  kind: 'insert',
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
      $base.Static.new({
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

  $base.Class.new({
    name: 'Revision',
    slots: [
      $base.Var.new({ name: 'revisionId' }),
      $base.Var.new({ name: 'repo' }),
      $base.Var.new({ name: 'parentIds', default: () => [] }),
      $base.Var.new({ name: 'patchFromParent', default: null }),
      $base.Var.new({ name: 'snapshot', default: '' }),
      $base.Var.new({ name: 'message', default: '' }),
      $base.Var.new({ name: 'createdAt', default: () => Date.now() }),
      $base.Method.new({
        name: 'text',
        do() {
          return this.snapshot();
        }
      }),
      $base.Method.new({
        name: 'parents',
        do() {
          return this.parentIds().map(pid => this.repo().getRevision(pid));
        }
      }),
      $base.Method.new({
        name: 'children',
        do() {
          return this.repo().getChildren(this.revisionId());
        }
      }),
      $base.Method.new({
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

  $base.Class.new({
    name: 'TextRepo',
    slots: [
      $base.Var.new({ name: 'root', default: null }),
      $base.Var.new({
        name: 'revisions',
        default: () => new Map()
      }),
      $base.Var.new({
        name: 'heads',
        default: () => new Map()
      }),
      $base.Method.new({
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
      $base.Method.new({
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
      $base.Method.new({
        name: 'getRevision',
        do(id) {
          return this.revisions().get(id);
        }
      }),
      $base.Method.new({
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
      $base.Method.new({
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
      $base.Method.new({
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
