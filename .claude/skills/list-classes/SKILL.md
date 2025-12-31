---
name: list-classes
description: 
allowed-tools: Bash
---

<Command>bun run bin/lister.js [classfile]</Command>
<Description>
Given a Simulabra module, print out a listing of the classes inside with their docstrings, line numbers, and slots
</Description>
<ExampleOutput>
ThisIsATest:6-20
  $.Var#frob the frob thing
  $.Method#grobnicate what it says on the tin
</ExampleOutput>
