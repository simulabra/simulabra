# Phase 3: .claude/skills/tree/SKILL.md

Create the agent skill descriptor for tree.

## File: .claude/skills/tree/SKILL.md

Follow the exact format of list-classes/SKILL.md:
- YAML frontmatter: name, description, allowed-tools: Bash
- `<Introduction>` section explaining what tree does
- `<Command>` section: `bun run bin/tree.js [path]`
- `<ExampleOutput>` section with realistic output

## Description
"Print a recursive directory tree of the Simulabra project showing files and the Simulabra classes defined in each file. Use this to get a quick structural overview of the project or any subdirectory."

## Acceptance criteria
- Skill appears in Claude Code skill list
- Running the command from the skill produces correct output
