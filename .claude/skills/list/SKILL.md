---
name: list
description: List classes and slots in a Simulabra module file
allowed-tools: Bash
---

Run `bun run bin/lister.js <file-path>` to list classes defined in a module. Use this to quickly examine the shape of a class and where it's located in the file. Add an optional class name at the end to filter for the class of that name, if it exists.

Schema:

    ClassName:startline-endline
      $.Slot#slotname doc value for the slot


Example output:

    $ bun run bin/lister.js tests/lister.js
    ThisIsATest:7-23
      $.Var#frob the frob thing
      $.Method#grobnicate what it says on the tin
      
    $ bun run bin/lister.js tests/core.js Point
    Point:10-20
      $.Var#x
      $.Var#y
      $.Method#dist
