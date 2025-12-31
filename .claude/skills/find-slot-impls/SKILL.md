---
name: find-slot-impls 
description: Use find-slot-impls if you are looking for the implementations of a slot with a given name. Do it instead of grepping or exploring with text based tools.
allowed-tools: Bash
---

<Introduction>
Simulabra is a slot-based system, and as such being able to find other slots throughout the project with a given name is a critical tool for development. find-slot-impls uses a Bun script consisting of a few shell commands to display a list of slots with their classes, parsed from the output of list-classes.
</Introduction>

<Command>
`bun run bin/finder.js [slotname]`
</Command>

<ExampleOutput>
````
> bun run bin/finder.js runcommand
=== demos/loom.js ===
Thread:414-547
  $.Method#runcommand(cmd)
Loom:576-822
  $.Method#runcommand(cmd)
=== demos/agenda.js ===
ActComponent:5-15
  $.Method#runcommand(cmd)
````
</ExampleOutput>
