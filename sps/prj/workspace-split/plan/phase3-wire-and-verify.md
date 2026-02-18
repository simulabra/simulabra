# Phase 3: Wire Workspace, Fix Imports, Verify

## Goal
Connect all extracted repos through the workspace root, fix broken import paths in demos, update test scripts, and verify everything works. Core still has its old copies — both old and new should work at this point.

## Steps

### 3.1 Fix demos imports
Rewrite relative imports to package names in all JS files:

**loom.js:**
```js
// from:
import html from '../src/html.js';
import { __, base } from '../src/base.js';
// to:
import { __, base } from 'simulabra';
import html from 'simulabra/html';
```

**counter.js:**
```js
// from:
import htmlModule from '../src/html.js';
import { __, base } from '../src/base.js';
// to:
import { __, base } from 'simulabra';
import htmlModule from 'simulabra/html';
```

**index.js:**
```js
// from:
import html from '../src/html.js';
import { __, base } from '../src/base.js';
// to:
import { __, base } from 'simulabra';
import html from 'simulabra/html';
```

**dummy/client.js:**
```js
// from:
import { __, base } from '../../src/base.js';
import html from '../../src/html.js';
import live from '../../src/live.js';
// to:
import { __, base } from 'simulabra';
import html from 'simulabra/html';
import live from 'simulabra/live';
```

**dummy/service.js:**
```js
// from:
import { __, base } from '../../src/base.js';
import live from '../../src/live.js';
// to:
import { __, base } from 'simulabra';
import live from 'simulabra/live';
```

### 3.2 Fix demos HTML entry points
The HTML files use `<script src="../src/base.js">` which won't resolve across repos. Two options:

**Option A (recommended):** Add a build step like swyperloom. Each demo gets a JS entry point that imports everything, and the HTML loads the bundled output:
```bash
# in demos/
bun build loom.js --outdir dist/loom
bun build counter.js --outdir dist/counter
```
HTML changes from `<script src="../src/base.js">` to `<script src="dist/loom/loom.js">`.

**Option B:** Use importmaps in the HTML to resolve `simulabra` → `../core/src/base.js`. Simpler but couples HTML to filesystem layout.

### 3.3 Update agenda test scripts
In `~/projects/simulabra/agenda/package.json`, the test scripts do `cd ../.. && bun run src/runner.js`. Replace with:
```json
"scripts": {
  "test": "bun run ../core/src/runner.js tests/ tests/services/",
  "test:services": "bun run ../core/src/runner.js tests/services/",
  "test:ui": "bun run ../core/src/runner.js tests/ui/"
}
```
Or, if core's runner export works via workspace resolution:
```json
"scripts": {
  "test": "bun run node_modules/simulabra/src/runner.js tests/ tests/services/"
}
```
Test both approaches to see which bun resolves correctly.

### 3.4 Update swyperloom test and build scripts
Same pattern as agenda. Also fix the build output path — currently `--outdir ../../out/swyperloom`, should become `--outdir dist`.

### 3.5 Install workspace dependencies
```bash
cd ~/projects/simulabra
bun install
```
This creates a root `node_modules/` with symlinks. `simulabra` symlinks to `core/`. Each workspace member can `import 'simulabra'`.

Verify symlink:
```bash
ls -la ~/projects/simulabra/node_modules/simulabra
# should point to ../core
```

### 3.6 Run all tests
```bash
# Core tests (from core/)
cd ~/projects/simulabra/core && bun run test

# Agenda tests (from agenda/)
cd ~/projects/simulabra/agenda && bun run test

# Swyperloom tests (from swyperloom/)
cd ~/projects/simulabra/swyperloom && bun run test

# Demos — verify imports resolve (no test suite, just import check)
cd ~/projects/simulabra/demos && bun run loom.js 2>&1 | head -5
```

### 3.7 Verify git history
Spot-check that history is preserved in extracted repos:
```bash
cd ~/projects/simulabra/agenda && git log --oneline -10
cd ~/projects/simulabra/agenda && git log --oneline -- src/models.js | head -5
```

## Potential Issues
- **bun workspace resolution with runner**: The test runner uses `import './base.js'` (relative). When invoked via `node_modules/simulabra/src/runner.js`, it resolves relative to its own location inside node_modules (which is a symlink to core/src/). This should work but needs verification.
- **HTML demos**: The `<script src>` approach is fundamentally incompatible with cross-repo imports. A build step is the clean solution. This is extra work but aligns demos with how swyperloom already works.
- **Double node_modules**: The workspace root creates `node_modules/` at `~/projects/simulabra/`. Each workspace member may also have its own `node_modules/` for member-specific deps (like agenda's redis, anthropic SDK). Bun handles this via hoisting — shared deps go to root, unique deps stay local.
- **agenda.db path**: agenda's code may reference a database path relative to its working directory. Since we're not changing the agenda code, just its location, the db file will be created in `~/projects/simulabra/agenda/agenda.db` which is correct.

## Key Files
- All demos JS files (import rewrites)
- All demos HTML files (script src updates)
- `agenda/package.json` (test scripts)
- `swyperloom/package.json` (test + build scripts)
- `~/projects/simulabra/node_modules/` (created by bun install)

## Acceptance Criteria
- `bun install` at workspace root succeeds
- `node_modules/simulabra` symlinks to `core/`
- Core tests pass from `core/`
- Agenda tests pass from `agenda/`
- Swyperloom tests pass from `swyperloom/`
- Demos JS files import from `'simulabra'` (not relative paths)
- No changes to `core/` source code (only core/package.json was changed in Phase 1)
