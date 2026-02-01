# Phase 2: tests/bin/tree.js

Create tests for tree.js following existing test patterns.

## Module setup
- Import `base` and `test`
- Import `tree` from `../../bin/tree.js`
- Module name: `test.bin.tree`

## Test cases

### TreeOutputContainsKnownClasses (AsyncCase)
- Run `bun run bin/tree.js` via `bun $`
- Assert stdout contains `Class` and `base.js`

### TreeIgnoresNodeModules (AsyncCase)
- Run `bun run bin/tree.js`
- Assert stdout does NOT contain `node_modules`

### TreeShowsDirectoryStructure (AsyncCase)
- Run `bun run bin/tree.js`
- Assert stdout contains `src/`, `bin/`, and tree chars (`├──` or `└──`)

### TreeSubdirectoryArg (AsyncCase)
- Run `bun run bin/tree.js src`
- Assert stdout contains `base.js`
- Assert stdout does NOT contain `demos/` or `bin/`

### TreeExtractClassNames (Case)
- Create `DirectoryTree` instance from imported tree module
- Call `extractClassNames` with synthetic source containing `$.Class.new({name: 'Foo', ...})`
- Assert returns `['Foo']`

## Acceptance criteria
- `bun run test-bin` passes all tests
