---
name: list-classes
description: Given a Simulabra module, print out a listing of the classes inside with their docstrings, line numbers, and slots
allowed-tools: Bash
---

<Introduction>
Simulabra classes are organized into modules, with one module per file. It is often useful to be able to see the classes in a file without reading the whole thing.
</Introduction>

<Command>bun run bin/lister.js [classfile]</Command>

<ExampleOutput>
````
> bun run bin/lister.js tests/bin/lister.js
ThisIsATest:6-20
  $.Var#frob the frob thing
  $.Method#grobnicate what it says on the tin
````
</ExampleOutput>
