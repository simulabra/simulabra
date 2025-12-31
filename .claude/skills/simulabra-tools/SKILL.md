---
name: simulabra-tools
description: A useful collection of tools to navigate Simulabra code. Always read when working on Simulabra before listing files and grepping for definitions. Contained tools: list-classes, find-slot-impls
allowed-tools: Bash
---

<Introduction>
Simulabra is a metaobject system for Javascript and associated libraries. Because of its unique syntax, it requires a custom set of tools to fully assist in development. Each tool consists of a prompt to read, which may reference scripts or yet more prompts.
</Introduction>

<ContextForUse>
It is good to know you have these at hand even if you do not need to use them yet.
</ContextForUse>

<Tool>
<Name>list-classes</Name>
<File>list-classes.md</File>
<Description>
Given a Simulabra module, print out a listing of the classes inside with their docstrings, line numbers, and slots
</Description>
</Tool>

<Tool>
<Name>find slot impls</Name>
<File>find-slot-impls.md</File>
<Description>
Given the name of a slot, find all the implementations of a slot with that name in the project
</Description>
</Tool>
