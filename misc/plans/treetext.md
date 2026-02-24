# treetext: branching text histories in simulabra

This is a plan for a prompt editor whose edits are tracked in a simple git-like tree. The focus here is on the versioning substrate and the shape of the objects and messages between them, not on the UI chrome or templating surface. The loom demo is the counterpoint: loom is about live text and model flows; treetext is about lived history and structural navigation.

The design goal is:
- represent text histories as a persistent graph of revisions
- store changes as patches, not only snapshots
- expose branching, merging, and traversal as methods on objects
- keep the core small enough to feel like a set of slots and messages, not a full VCS

The plan treats "diffing" as a modelling problem, not just an algorithm. The choices we make about text shape, patch operations, and identity all show up in the public interface.


## constraints and desiderata

Some constraints from the intended prompt editor:

- Text is usually small to medium sized (prompts, not novels), but we want the model to work for long text too.
- Editing is interactive and frequent; we do not want to store one revision per keystroke.
- We want a "save checkpoint" button that creates an explicit node in the history graph.
- The UI will show a list of checkpoints, with markers whenever there are other branches from the same ancestor.
- The user should be able to:
  - move the working buffer to any revision (`checkout`)
  - create a new branch implicitly by checkpointing from an older revision
  - see "what changed" between any two points (revision → revision, or revision → working buffer)
  - eventually merge branches or copy sections across branches (future work)

Simulabra constraints:

- Objects and messages, not ad‑hoc records: we want `$Revision`, `$Patch`, `$DiffOp`, `$Repo`, `$Buffer`.
- Use slots for evolving behaviour: e.g. `Patch.apply(text)`, `Revision.summary()`, `Repo.pathTo(revision)`.
- Keep data structures JSON‑serializable so we can use `jsonify` and the module registry.
- Make it easy to wire into signals and commands: `Signal` for current revision, `Command` for `commit`, `checkout`, `branch`, `merge`.


## text as an object

Before diffing, decide what "text" is.

The simplest model is a single string. Loom already treats `text` as a `Signal` of type string on `Loom` and `Thread`. That is the baseline: treetext must, at minimum, version a plain string.

But the prompt editor we care about will want:
- smart templating: named slots or holes inside the text
- provenance: which segments came from the model vs the user
- maybe structure: sections, headers, notes

There are two obvious approaches:

1. **Strings + metadata outside the core**
   - Core treetext only knows about plain strings.
   - Callers who care about templates or provenance keep their own parallel structures keyed by revision IDs or positions.
   - Diffing is line/character level over strings.

2. **Segmented text**
   - Model the buffer as an ordered list of "segments".
   - Each segment has `kind` (user, model, template), `text`, and optional metadata.
   - Diff operates on segments, not raw characters.

For the first prototype, treetext will treat text as a string, but we design the patch format so that it can later be parameterised over "segments". The plan will talk about string patches, with the caveat that `Segment` is a future class.

We define a conceptual `$TextBuffer`:
- slots:
  - `text` (`Signal<string>`)
  - `currentRevision` (`Signal<Revision | null>`)
  - `unsavedPatch` (`Signal<Patch | null>`) – computed diff from `currentRevision.text` to `text`
- messages:
  - `checkpoint(message)`: ask the repo to commit the current buffer
  - `checkout(revision)`: replace `text` with that revision's text and update `currentRevision`
  - `revertTo(revision)`: like `checkout` but also discards outstanding local edits

The buffer itself does not know about the history graph; it delegates to a repo.


## diffing as a modelling choice

We want to record the change from one text to another as a `Patch` object. A patch is a sequence of "ops", each op describing how to transform the source text into the target text. Conceptually:

- `retain(n)`: keep `n` characters from source
- `insert(text)`: insert new text
- `delete(n)`: delete `n` characters from the source

This is deliberately similar to operational transforms / OT and some CRDT patch formats. It is a good fit for Simulabra because:
- the operations are small, composable objects
- we can treat each op as an instance (`$DiffOp`) with methods (`apply`, `invert`, `summary`)
- patches can be traversed reactively and visualised in the UI

A `Patch` then is:
- a source length
- a target length
- an ordered list of `DiffOp` instances

We need a `Diff` object whose job is to compute a `Patch` given `oldText` and `newText`. That is where the algorithm lives.


### naive options and tradeoffs

Some options for how to compute the patch:

1. **Snapshot‑only**
   - Do not compute patches at all; store full text on every revision.
   - Show diffs in the UI by computing a diff between the two snapshots on demand.
   - Pros: trivial; no algorithmic work at commit time.
   - Cons: no structural patches; no cheap ancestry queries ("which revision introduced this line?"); large storage for longer texts.
   - Verdict: we may keep snapshot fields for convenience, but the main interface should be patch‑oriented.

2. **Line‑based diff**
   - Split on `\n`, compute LCS or Myers diff on lines.
   - Represent ops as add/remove/keep of lines; store per‑line text.
   - Pros: easy to understand visually; similar to git; good for code and structured prompts.
   - Cons: does not capture small edits well (e.g. one word edit in a long line); does not work well when we care about tokens.

3. **Character‑based diff**
   - Treat text as an array of characters, run a standard diff algorithm (Myers, Wagner–Fischer, etc).
   - Produce insert/delete/retain ranges in character indices.
   - Pros: minimal patch size in terms of characters; easy to apply; good for arbitrary text.
   - Cons: visually noisy; small changes can look scattered; more sensitive to local reflows.

4. **Token‑based diff**
   - Split by whitespace or punctuation into "tokens".
   - Diff tokens; map back to character ranges.
   - Pros: closer to prompt semantics; nicer change summaries.
   - Cons: more complexity (tokeniser choices); we will eventually want model‑token alignment which is another layer.

treetext should start with a character‑based diff and wrap it in objects that are agnostic to granularity. Later we can swap the internal diff strategy to token‑ or segment‑based without changing callers, as long as `Patch.apply` and `Patch.summary` stay stable.


### algorithm sketch

We will define a `$DiffEngine` class responsible for `computePatch(oldText, newText)`.

Constraints:
- we control the environment; no need for external libraries
- simplicity is more important than asymptotic optimality, but we should not be quadratic on moderate inputs

Options:

- Implement a simple Myers diff for character arrays.
  - Represent each path as a sequence of insert/delete/retain steps.
  - Collapse consecutive operations of the same type into single `DiffOp`s.
- Alternatively, implement a bounded dynamic programming diff with a maximum window (good enough for prompts under, say, 8–16k chars).

For the plan, we assume we will implement a small Myers‑style engine in a `DiffEngine` module:

- input: `oldText: string`, `newText: string`
- output: `Patch` instance such that `Patch.apply(oldText) === newText`

`DiffEngine` exposes:
- `computePatch(oldText, newText) → Patch`
- `computeInverse(patch) → Patch` (optional; or we derive inverse ops on `Patch` itself)

`Patch` exposes:
- `apply(text) → string`
- `inverse() → Patch`
- `summary() → string | SummaryObject` (for UI consumption)

This mirrors Simulabra's pattern for other value objects: we keep the state in slots, behaviour in methods, and JSON serialisation via `jsonify`.


## the revision graph

We want a git‑like tree, but not a full DAG with arbitrary merges at first. The minimal structure:

- A `Revision` has:
  - `id`: numeric or string identifier
  - `parentIds`: list of parent IDs (usually one; more only after we add merging)
  - `patchFromParent`: a `Patch` describing the change from the primary parent to this revision
  - `snapshot`: optional cached full text (string)
  - `message`: user‑visible label for the checkpoint
  - `createdAt`: timestamp
  - maybe `tags` / `branchName` later

- A `Repo` has:
  - `rootRevision`: the initial empty or seed revision
  - `revisionsById`: map of ID → Revision
  - `heads`: map of logical branch name → revision ID (optional)

Conceptually:

- The history forms a rooted tree of revisions as long as we allow only one parent on commit.
- Creating a checkpoint from an older revision simply attaches a new child to that revision; the working buffer moves to the new child.
- The user can have multiple branches by checkpointing from different ancestors.

The key operations on `Repo`:

- `commit(buffer, message) → Revision`
  - compute patch between `buffer.currentRevision.text` (or root) and `buffer.text`
  - create new `Revision` with parent = `buffer.currentRevision`
  - update head pointer for the current branch (if we track branches)
  - set `buffer.currentRevision` to the new revision, clear `unsavedPatch`

- `checkout(revision, buffer)`
  - compute the full text for `revision` (see below)
  - set `buffer.text` to that text
  - set `buffer.currentRevision` to `revision`
  - compute new `unsavedPatch` (empty)

- `textOf(revision) → string`
  - either:
    - walk from root to `revision` applying patches; cache snapshot on each node
    - or store snapshots eagerly and only use patches for deltas in UI

Because texts are small, we can afford to store snapshots on each revision. Patches are still useful:
- to show "what changed" between arbitrary revisions
- to support branching‑aware UIs
- to later implement merges

So the plan is:
- store both `snapshot` and `patchFromParent` on each `Revision`
- `textOf(revision)` returns `revision.snapshot` directly
- we recompute snapshots only if we ever create revisions from patches alone (e.g. replaying a history)


## objects and messages

We sketch the main classes and their important slots and messages. Names are indicative; we will refine when we write the module.


### `$TextRepo` (treetext repository)

Role: hold the revision graph for a single logical text. In a more advanced system we may have multiple repos (e.g. one per document), but the initial prompt editor can start with one.

Slots:
- `id` (Var) – numeric ID
- `name` (Property) – human‑readable name for the repo
- `root` (Var<Revision>) – the root revision (id 0)
- `revisions` (Var<Map<id, Revision>>) – all revisions
- `heads` (Var<Map<branchName, id>>) – branch heads (optional)

Messages:
- `initSeed(text: string)` – create root revision from initial text
- `commit(buffer, message: string) → Revision`
- `checkout(revisionOrId, buffer)`
- `branch(name: string, fromRevision?)` – record a named branch starting at a given revision
- `head(branchName) → Revision`
- `pathTo(revision) → Revision[]` – path from root to given revision
- `commonAncestor(a, b) → Revision`
- `diffBetween(a, b) → Patch` – compute patch from `a.snapshot` to `b.snapshot` via `DiffEngine`

The repo is a `$Class` that other modules can depend on; instances are registered in a module and can be found via the module registry if needed.


### `$Revision`

Role: represent a single point in the history graph.

Slots:
- `id` (Var<number>)
- `repo` (Var<TextRepo>)
- `parentIds` (Var<Array<number>>)
- `patchFromParent` (Var<Patch | null>)
- `snapshot` (Var<string>) – full text at this revision
- `message` (Var<string>)
- `createdAt` (Var<Date | number>)

Messages:
- `text() → string` – returns `snapshot`
- `parents() → Revision[]`
- `children() → Revision[]` – asks the repo to find child revisions
- `summary() → string` – short human readable summary of the patch
- `branchPoints() → Revision[]` – siblings sharing same parent (for UI markers)


### `$Patch`

Role: sequence of operations from one text to another.

Slots:
- `ops` (Var<Array<DiffOp>>)
- `sourceLength` (Var<number>)
- `targetLength` (Var<number>)

Messages:
- `apply(text: string) → string`
- `inverse() → Patch`
- `compose(nextPatch: Patch) → Patch` – optional: combine two patches into one
- `isEmpty() → boolean`
- `summary() → SummaryObject` – for UI; e.g. number of insertions/deletions, first changed line, etc.

The `apply` method walks `ops`:
- maintain an index into the source string
- for `retain(n)`: append `text.slice(idx, idx + n)` to result, advance `idx`
- for `delete(n)`: skip `n` chars from source, advance `idx`
- for `insert(s)`: append `s` directly

`inverse` is computed by swapping insert/delete and using the same retain counts.


### `$DiffOp`

Role: a single operation in a patch.

Slots:
- `kind` (Var, spec: $Enum.of('retain', 'insert', 'delete'))
- `count` (Var<number>) – for `retain` and `delete`
- `text` (Var<string | null>) – for `insert`

Messages:
- `applyTo(text, idx) → { resultFragment, nextIdx }`
- `inverse() → DiffOp | DiffOp[]`
- `lengthDelta() → number` – how much this op changes the length

These are small enough that we may not need a full class, but keeping them as Simulabra objects is useful for inspection and debugging.


### `$DiffEngine`

Role: compute patches between snapshots; pure logic with no persistent identity.

Slots:
- none required; it can be a stateless class with static methods.

Messages:
- `computePatch(oldText, newText) → Patch`
- `computeSimilarity(a, b) → number` – optional: used for branch summaries or merge heuristics

In practice, `TextRepo.commit` will ask `DiffEngine` for a patch:

```js
const patch = $DiffEngine.computePatch(currentRevision.text(), buffer.text());
```

The patch becomes part of the new `Revision`.


### `$TextBuffer`

Role: represent the live editable text in the UI, plus its relationship to the repo.

Slots:
- `text` (Signal<string>)
- `repo` (Var<TextRepo>)
- `currentRevision` (Signal<Revision>)
- `unsavedPatch` (Signal<Patch | null>)

Messages:
- `recomputeUnsavedPatch()` – recompute diff between `currentRevision.text()` and `text()`
- `checkpoint(message)` – call `repo.commit(this, message)`
- `checkout(revision)` – delegate to `repo.checkout` and update signals
- `isDirty() → boolean` – whether `unsavedPatch` is non‑empty

In a React‑style UI, typing in the prompt editor updates `text`; a `Signal`‑powered effect recomputes `unsavedPatch` with a debounce. The checkpoint button calls `checkpoint`.


## branching semantics

In git, branches are names that point at revisions. In the UI, we mostly care about:
- whether there are multiple children from a given revision (branch point)
- which path we are currently following from root to working head

treetext does not need full git semantics. A minimal approach:

- Every `Revision` knows its parent(s).
- `TextRepo.pathTo(revision)` computes the chain of ancestors up to root.
- `Revision.branchPoints()` asks the repo for other children of its parents; if there are any, we expose them as branch markers in the UI.
- We optionally allow naming branches:
  - `Repo.heads` maps branch names to revisions.
  - `Repo.setHead(name, revision)` sets or moves a branch.
  - The working buffer tracks which head it is attached to (for future `merge` commands).

In terms of messages:
- `TextRepo.childrenOf(revision) → Revision[]`
- `TextRepo.branchHeads() → Map<branchName, Revision>`
- `TextRepo.revisionsAtDepth(depth) → Revision[]` (for visualisation)

The UI can then render:
- a vertical list of revisions along the current path
- small indicators wherever `childrenOf` returns multiple children
- a palette or dropdown listing other heads and allowing quick checkout


## change lists and queries

Once patches and revisions exist as objects, we can provide rich queries over them. Some useful ones:

- "What changed since last checkpoint?"
  - `buffer.unsavedPatch.summary()`
  - or `repo.diffBetween(currentRevision, workingBufferSnapshot)`

- "What changed between revision A and B?"
  - `repo.diffBetween(A, B)` returns a `Patch`
  - `Patch.summary()` returns a structured object: counts of insertions/deletions, first changed line, etc.

- "Show me the path and descriptions from root to this revision."
  - `repo.pathTo(revision)` returns an array of `Revision`
  - UI shows `revision.message` and a short summary of the patch at each step.

- "Where did this line come from?"
  - For each revision in the path, apply its patch and track which ranges of text originate at which ancestor.
  - That is more expensive, but for prompts it is acceptable; this can be added later.

To keep it in the Simulabra idiom:
- `Repo` and `Revision` methods return objects, not raw arrays or primitives when possible.
- Queries can be used from other modules as long as they depend on the same module that defines treetext.


## alignment with loom and future templating

The loom demo defines:
- a `Loom` class with a `text` signal, undo stack, and history of commands
- a `Command` slot type whose `run` returns an undo function

treetext should integrate, not compete, with that model:

- Instead of replacing loom's `undostack`, treetext can use the same `Command` pattern for higher‑level actions:
  - `CheckpointCommand` whose `run` commits a new revision and returns an undo that removes it or moves head back.
  - `CheckoutCommand` that moves `currentRevision` and updates `text`.

- In the prompt editor, there may be two parallel histories:
  - a fine‑grained undo/redo stack for individual edits (keystrokes, insertions, etc.), managed as commands
  - a coarse‑grained revision tree, managed by treetext

Diffing sits between them:
- As the user edits, the buffer accumulates a difference to the last checkpoint.
- When the user saves a checkpoint, we compute a patch summarising all those micro‑edits.
- The patch is stored on a `Revision`; we discard or compress the micro‑history if desired.

For smart templating:
- later we can define `Segment` and `TemplateSlot` classes:
  - `Segment` has `kind` (user/model/template), `text`, and `metadata`.
  - `TemplateSlot` may itself hold a mini‑history of values.
- `DiffEngine` can be parameterised to operate on `Segment[]` rather than characters, while still emitting `DiffOp`s.

The important part now is to keep the patch API neutral to granularity so this extension is natural.


## implementation outline

When we move from plan to code, a reasonable sequence:

1. **Module skeleton**
   - Create a `treetext` module defining `$TextRepo`, `$Revision`, `$Patch`, `$DiffOp`, `$DiffEngine`, `$TextBuffer`.
   - Ensure classes are registered in a module and accessible via `$`.

2. **Patch and diff engine**
   - Implement `DiffOp` and `Patch` with `apply` and `inverse`.
   - Implement a small character‑level `DiffEngine.computePatch`.
   - Add tests in `tests/` for:
     - identity diff (`old === new`)
     - simple insert/delete/replace
     - behaviour on empty strings

3. **Revision graph**
   - Implement `TextRepo` and `Revision`, with in‑memory maps.
   - Implement `commit`, `checkout`, `textOf`, `pathTo`, `diffBetween`.
   - Add tests for simple linear histories and branching.

4. **Buffer integration**
   - Implement `TextBuffer` with `Signal` slots.
   - Wire `recomputeUnsavedPatch` into an `Effect` that runs when `text` or `currentRevision` changes.
   - Add tests using the built‑in test framework to ensure signals update correctly.

5. **UI sketch**
   - A small demo module that shows:
     - a textarea bound to `TextBuffer.text`
     - a checkpoint button calling `TextBuffer.checkpoint`
     - a list of revisions with branches, using `pathTo` and `childrenOf`
   - Use this to validate that the diff summaries and branching indicators make sense.

The overall aim is to have a compact set of Simulabra classes that make text history a first‑class citizen in the system, ready to be used by a richer prompt editor and later, by templated, model‑aware text workflows.

