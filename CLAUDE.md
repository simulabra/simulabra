# CLAUDE.md

## SIMULABRA: INFINITE SOFTWARE
Simulabra is a metaobject system and software universe for Javascript. 

## A guide to writing Simulabra
 - Be consistent with naming  - do not use overly short names in public interfaces. 
 - DO NOT ADD COMMENTS unless they are necessary, prefer doc strings and readable code.
 - The shortest solution is generally best, but it is most important to handle complexity. 
 - Consider different approaches and tradeoffs when encountering difficult problems. 
 - Try to always do things the Simulabra way, in style and idiom.  

## Commands

### Development Commands
- `bun run test` - Run tests
- `bun run serve` - Start the server (port 3031)
- `./build.sh` - Build demos to `out/` directory

## Architecture

### Core System
This is **Simulabra**, a JavaScript metaobject system that implements a custom class system resembling the Common Lisp Object System (specifically the original Flavors). It provides:

- **Declarative class definitions** with slots, methods, and multiple inheritance
- **Method combination** using Before/After hooks instead of `super` calls
- **Reactive programming** with Signals and Effects
- **Module system** with dependency injection
- **Component-based UI** system

### Key Modules

#### Base System (`src/base.js`)
The core metaobject system providing the foundational classes:
- Custom class system with multiple inheritance
- Variable slots with automatic getters/setters
- Method combination (Before/After hooks)
- Reactive Signal/Effect system
- Module system with imports and namespacing

#### HTML System (`src/html.js`)
Template-based reactive UI system:
- Virtual DOM with `$.VNode.h()` factory
- Tagged template literals (`$.HTML.t`)
- Component system with automatic reactive updates
- AST-based template compilation

#### Test System (`src/test.js`)
Testing framework integrated with the class system:
- Test cases as classes
- Assertion methods
- Async test support

### Testing
Tests are in `tests/` directory using the built-in test framework.
