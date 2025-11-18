import html from "../src/html.js";
import { __, base } from "../src/base.js";
import diff from "../src/diff.js";

export default await function (_, $, $base, $html, $diff) {
  $base.Class.new({
    name: 'RevisionNode',
    slots: [
      $html.Component,
      $base.Var.new({ name: 'revision' }),
      $base.Var.new({ name: 'app' }),
      $base.Var.new({ name: 'isCurrent', default: false }),
      $base.Method.new({
        name: 'renderDiffOps',
        do() {
          const rev = this.revision();
          const patch = rev.patchFromParent();
          if (!patch) return '';

          return patch.ops().map(op => {
            return $.DiffOpView.new({ op }).render();
          });
        }
      }),
      $base.Method.new({
        name: 'render',
        do() {
          const rev = this.revision();
          const childCount = rev.children().length;
          const hasBranch = childCount > 1;

          return $html.HTML.t`
            <div class="revision-node ${() => this.isCurrent() ? 'current' : ''}">
              <div
                class="revision-clickable"
                onclick=${() => this.app().checkout(rev)}
              >
                <div class="revision-header">
                  <span class="revision-id">r${rev.revisionId()}</span>
                  ${hasBranch ? $html.HTML.t`<span class="branch-indicator">⑂</span>` : ''}
                </div>
                <div class="revision-message">${rev.message()}</div>
                <div class="revision-summary">${rev.summary()}</div>
              </div>
              ${rev.patchFromParent() ? $html.HTML.t`
                <div class="revision-diff">
                  ${() => this.renderDiffOps()}
                </div>
              ` : ''}
            </div>
          `;
        }
      })
    ]
  });

  $base.Class.new({
    name: 'DiffOpView',
    slots: [
      $html.Component,
      $base.Var.new({ name: 'op' }),
      $base.Method.new({
        name: 'render',
        do() {
          const op = this.op();
          const kind = op.kind();

          if (kind === 'retain') {
            return $html.HTML.t`<span class="diff-retain">${op.count()} chars</span>`;
          } else if (kind === 'insert') {
            return $html.HTML.t`<span class="diff-insert">+${op.text()}</span>`;
          } else if (kind === 'delete') {
            return $html.HTML.t`<span class="diff-delete">-${op.count()} chars</span>`;
          }
        }
      })
    ]
  });

  $base.Class.new({
    name: 'TreeTextApp',
    slots: [
      $html.Component,
      $base.Var.new({ name: 'repo' }),
      $base.Signal.new({ name: 'currentRevision', default: null }),
      $base.Signal.new({ name: 'text', default: '' }),
      $base.Signal.new({ name: 'commitMessage', default: '' }),
      $base.Signal.new({ name: 'showDiff', default: false }),
      $base.After.new({
        name: 'init',
        do() {
          const repo = $diff.TextRepo.new({ name: 'demoRepo' });
          const root = repo.initSeed('Write a prompt for an AI assistant');
          this.repo(repo);
          this.currentRevision(root);
          this.text(root.text());
        }
      }),
      $base.Method.new({
        name: 'commit',
        do() {
          if (!this.hasChanges()) return;
          const message = this.commitMessage() || 'update';
          const newRev = this.repo().commit(
            this.currentRevision(),
            this.text(),
            message
          );
          this.currentRevision(newRev);
          this.commitMessage('');
        }
      }),
      $base.Method.new({
        name: 'checkout',
        do(revision) {
          this.currentRevision(revision);
          this.text(revision.text());
        }
      }),
      $base.Method.new({
        name: 'hasChanges',
        do() {
          return this.text() !== this.currentRevision().text();
        }
      }),
      $base.Method.new({
        name: 'currentPatch',
        do() {
          if (!this.hasChanges()) return null;
          return $diff.DiffEngine.computePatch(
            this.currentRevision().text(),
            this.text()
          );
        }
      }),
      $base.Method.new({
        name: 'renderRevisionTree',
        do() {
          const revisions = Array.from(this.repo().revisions().values());
          const current = this.currentRevision();

          return revisions.map(rev => {
            const node = $.RevisionNode.new({
              revision: rev,
              app: this
            });
            node.isCurrent(rev.revisionId() === current.revisionId());
            return node.render();
          });
        }
      }),
      $base.Method.new({
        name: 'renderDiffOps',
        do() {
          const patch = this.currentPatch();
          if (!patch) return '';

          return patch.ops().map(op => {
            return $.DiffOpView.new({ op }).render();
          });
        }
      }),
      $base.Method.new({
        name: 'render',
        do() {
          const handleKeydown = e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
              e.preventDefault();
              this.commit();
            }
          };

          return $html.HTML.t`
            <div class="loom">
              <div class="loom-col">
                <textarea
                  class="treetext-textarea"
                  value=${() => this.text()}
                  oninput=${e => this.text(e.target.value)}
                  onkeydown=${handleKeydown}
                  placeholder="Enter your text here..."
                ></textarea>
              </div>

              <div class="loom-col">
                <div class="section-label">current revision</div>
                <div class="loom-row">
                  <span>r${() => this.currentRevision().revisionId()}: ${() => this.currentRevision().message()}</span>
                </div>

                <div class="section-label">actions</div>
                <div class="loom-row">
                  <input
                    type="text"
                    class="commit-message-input"
                    value=${() => this.commitMessage()}
                    oninput=${e => this.commitMessage(e.target.value)}
                    placeholder="commit message"
                  />
                  <button
                    onclick=${e => { this.commit(); e.target.blur(); }}
                    disabled=${() => !this.hasChanges()}
                  >
                    commit
                  </button>
                  <button
                    onclick=${e => { this.showDiff(!this.showDiff()); e.target.blur(); }}
                  >
                    ${() => this.showDiff() ? 'hide diff' : 'show diff'}
                  </button>
                </div>

                <div class="loom-row" hidden=${() => !this.hasChanges() || !this.showDiff()}>
                  ${() => this.renderDiffOps()}
                </div>

                <div class="section-label">revision tree (${() => this.repo().revisions().size})</div>
                <div class="loom-col">
                  ${() => this.renderRevisionTree()}
                </div>
              </div>
            </div>
          `;
        }
      }),
      $base.Method.new({
        name: 'css',
        do() {
          return `
            .treetext-textarea {
              background: var(--light-sand);
              padding: 1em;
              height: 100%;
              min-height: 20em;
              display: block;
              resize: none;
            }

            .commit-message-input {
              flex: 1;
              min-width: 10em;
            }

            .diff-retain {
              color: var(--charcoal);
            }

            .diff-insert {
              color: var(--grass);
            }

            .diff-delete {
              color: var(--dusk);
            }

            .revision-node {
              padding: 2px;
              border: 2px solid var(--wood);
              box-sizing: border-box;
            }

            .revision-clickable {
              cursor: pointer;
            }

            .revision-clickable:hover {
              box-shadow: var(--box-shadow-args-inset);
            }

            .revision-node.current {
              background: var(--sky);
              color: var(--seashell);
            }

            .revision-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
            }

            .revision-id {
              font-weight: bold;
            }

            .branch-indicator {
              color: var(--dusk);
            }

            .revision-node.current .branch-indicator {
              color: var(--seashell);
            }

            .revision-message {
              font-size: 0.9em;
            }

            .revision-summary {
              font-size: 0.8em;
              font-style: italic;
            }

            .revision-diff {
              margin-top: 2px;
              font-size: 0.85em;
              display: flex;
              flex-wrap: wrap;
              gap: 4px;
            }
          `;
        }
      })
    ]
  });

  $.TreeTextApp.new().mount();
}.module({
  name: 'demo.treetext',
  imports: [base, html, diff],
}).load();
