# Phase 1: bin/tree.js

Create `bin/tree.js` with a `DirectoryTree` Simulabra class.

## Module setup
- Import `readFileSync, readdirSync` from `node:fs`, `join, resolve, basename` from `node:path`, and `base` from `../src/base.js`
- No domshim needed — pure source parsing
- Module name: `tree`, imports: `[base]`

## Slots

### ignoreDirs (Var)
Default: `new Set(['node_modules', 'out', 'tmp', 'misc', 'logs', 'sps', 'me', '.claude', '.git', 'contexts', 'dist'])`

### extractClassNames(source) (Method)
- Split source into lines
- For each line matching `/.Class.new\s*\(\s*\{/`, look ahead ≤5 lines for `name:\s*['"]([^'"]+)['"]`
- Return array of matched class name strings

### shouldIgnore(dirName) (Method)
- Return `this.ignoreDirs().has(dirName)`

### collectTree(dirPath) (Method)
- `readdirSync(dirPath, { withFileTypes: true })`
- Separate into dirs (non-ignored, sorted) and .js files (sorted)
- For dirs: recurse, include only if children.length > 0
- For files: readFileSync, extractClassNames, push `{ name, type: 'file', classes }`
- Return `{ name: basename(dirPath), type: 'dir', children }`

### formatTree(node) (Method)
- Top-level children render as bare headers: `dirname/`
- Nested: `├── ` for non-last, `└── ` for last
- Continuation: `│   ` for non-last, `    ` for last
- Class names on continuation line: `prefix + classes.join(', ')`
- Returns joined string

### run(targetPath) (Method)
- Resolve path relative to project root (`join(import.meta.dirname, '..')`)
- collectTree → formatTree → console.log

## Entry point
```javascript
if (require.main === module) {
  const tree = _.DirectoryTree.new();
  tree.run(process.argv[2] || '.');
  process.exit(0);
}
```

## Acceptance criteria
- `bun run bin/tree.js` produces clean tree output
- `bun run bin/tree.js src` scopes to src/
- node_modules and other ignored dirs absent from output
