---
name: tree
description: Show the project directory structure with Simulabra class names per file, using tree-drawing characters
allowed-tools: Bash
---

<Introduction>
The tree tool recursively lists directories and .js files, extracting Simulabra class names via source-text parsing. It skips ignored directories (node_modules, .git, out, etc.) and displays the structure with box-drawing characters. Pass a subdirectory path to scope the output.
</Introduction>

<Command>bun run bin/tree.js [path]</Command>

<ExampleOutput>
````
> bun run bin/tree.js
src/
├── base.js
│   StaticVar, SimulabraGlobal, Reactor, Effect, EnumVar, Signal, ...
├── html.js
│   AstNodeCompilerBase, ElementNodeCompiler, TextNodeCompiler, ...
├── test.js
│   Case, AsyncCase, BrowserCase
demos/
├── loom.js
│   OpenAIAPIClient, ThreadConfig, TextCompletion, Thread, Logprob, Loom
bin/
├── lister.js
│   ModuleLister
└── tree.js
    DirectoryTree
````
</ExampleOutput>
