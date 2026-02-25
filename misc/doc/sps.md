# Simulabra Project System 
The Simulabra Project System (SPS) is a file-based software development work tracker. 

```
$ cat sps/projects.jsonl
{"name": "agenda-refactor", "brief": "increase code quality of the agenda app and potential library improvements", "startedAt": "2026-01-31T20:56:33.123Z", "status": "NOT STARTED"}
$ ls sps/prj/agenda-refactor
docs/
plan/
PROJECT.md
WORKLOG.md

$ cat sps/prj/agenda-refactor/PROJECT.md
---
tltle: agenda-refactor
description: increase code quality of the agenda app and potential library improvements
tags:
    - agenda
    - refactor
---

# Agenda refactor

## Project overview
The agenda application has seen a good deal of work recently, with many new features. But before we go further, it needs to be refactored, with lessons extracted back to the main library. 

## Status
Not started. Would be blocked by any other active work on agenda.

## History
### 1.31.2026
- created project from user intent
```


## Project catalog
`sps/projects.jsonl` contains a catalog of projects with basic information like the name/directory, the time it started, and the status. It also contains a brief that describes the goals of the project in a relatively short sentence.

### Schema
name: string (no spaces, used as directory)
brief: string
startedAt: ISO timestamp
status: "NOT STARTED" | "IN PROGRESS" | "COMPLETE" | "ON HOLD" | "CANCELED"
tags: string[] (lowercase, hyphenated; optional, defaults to [])

The `sps` CLI (`bin/sps.js`) is the canonical way to manage tags. It keeps the catalog and PROJECT.md frontmatter in sync.

## Tag Registry
`sps/TAGS.md` is a human-readable markdown table that documents the tag vocabulary:

```markdown
| Tag | Description |
|-----|-------------|
| agenda | Agenda productivity app |
| cli | Command-line tooling |
```

The registry is **advisory, not restrictive** — unknown tags produce a warning but still apply. This keeps the system flexible while encouraging a shared vocabulary.

Management commands:
- `sps tags` — list tags with counts and descriptions from the registry
- `sps tags --seed` — populate TAGS.md from all tags currently in use across projects
- `sps tag-define <tag> [description]` — register a tag or update its description
- `sps tag-remove <tag>` — remove a tag from the registry (doesn't untag projects)

The architect skill consults TAGS.md during project creation to suggest tags from the existing vocabulary.

## Project directory
All files for a project are stored in `sps/prj/{project.name}/`.

### PROJECT.md
`PROJECT.md` is the information hub of the project. The intention is to get an interested party up to speed on a project without overwhelming theme in minutiae. 

It containes the following sections:

#### Frontmatter
Include frontmatter with the title and description from the project catalog, and any tags that might apply.

#### Project overview
A paragraph version of the brief, with more details about the goals and desired outcomes of the project, and more on its context in the broader system.

#### Status
A short, accurate description of the current status of the project. Include any blockers or prereqs that need to be called out.

#### History
A comprehensive log of short messages for each item of work done for a project, organized into headers with the date. 

### docs/
Contains high-level project document markdown files, like PRDs, research notes, reports, etc.

### plan/
Contains plan files - 1 for each phase, broken down into amounts that can be reasonably accomplished in one session. Name files like `phase1-style-consistency.md`

### WORKLOG.md
More granular log of work done, separated into sections by day. Include interpreted requests from the user, files created, scope changes, thoughts about out-of-scope work, musings, accomplishments, etc. 

## CLI

`bin/sps.js` is a Simulabra module CLI for querying and managing the project catalog. It lives at the workspace root, next to `sgit.js`.

```
sps list                            # all projects (default command)
sps list --status "IN PROGRESS"     # filter by status
sps list --tag agenda               # filter by tag
sps list --tag agenda --tag review  # multiple tags (AND logic)
sps show <name>                     # project detail view
sps tag <name> <tag1> [tag2...]     # add tags (updates JSONL + PROJECT.md)
sps untag <name> <tag1> [tag2...]   # remove tags (updates JSONL + PROJECT.md)
sps tags                            # list all tags with project counts and descriptions
sps tags --seed                     # populate TAGS.md from project tags in use
sps tag-define <tag> [description]  # register a tag or update its description
sps tag-remove <tag>                # remove a tag from the registry
sps help                            # usage information
```

The CLI discovers `sps/projects.jsonl` by walking up from the current directory (same pattern as sgit). Tag mutations keep the catalog and PROJECT.md frontmatter in sync.

## Doc review

Design docs and plan files support inline review comments. A comment is any line starting with an ALL-CAPS word followed by a colon:

```
NOTE: why not REST here?
QUESTION: does this handle the offline case?
TODO: add error codes
GOOD: this section is solid
```

There is no fixed vocabulary — any `CAPS:` line is a comment. The word conveys intent, the text after the colon is the substance.

### Process

1. Claude generates a doc (in `docs/` or `plan/`)
2. The user reads it and adds comments anywhere in the file
3. Claude re-reads the doc, finds all comment lines, and incorporates the feedback — revising the doc and removing each comment
4. Each comment gets a bullet in `WORKLOG.md` under a `### Review Round N` heading
5. If Claude needs to respond rather than just act, it leaves its own comment in the same format for the next round
6. Repeat until the doc is clean

## The system

### Before starting work
Always check the project's current state before diving in:
- Read `projects.jsonl` to see the project status and brief.
- Read the project's `PROJECT.md` to see which phases are done, in progress, or planned.
- Scan markdown files in `docs/` and `plan/` for **review comments** — lines matching `^[A-Z]+:` (e.g. `NOTE:`, `QUESTION:`, `TODO:`). If any are found, process them before other work.

### Initializing a project
First, when the user mentions starting a new project, confirm the name and brief using the AskUserQuestion tool.

After confirming, create the project directory structure, `PROJECT.md` file, and `WORKLOG.md`. Ask about first steps - requirement gathering, research, prototyping, etc.

### Information gathering
Before starting work, it is typically prudent to refine your thoughts around the matter.

#### Using codex
In my own testing I have found codex with gpt-5.2 to be better at pure knowledge work. Delegate high-level docs tasks to it like so (make sure to include the location of the doc):
```
$ codex e "Analyze the code base and architecture of the agenda app, looking for bad abstractions, excessive duplication, and other sources of accidental complexity. Write your report to sps/prj/agenda-refactor/docs/analysis.md. Include file locations with line numbers and suggestions for improvements, but no code. Include libraries the app is using in the scope of this report."
```

Codex is slow, and will generate a lot of output while running. Run it in a tmux session, then do your own information gathering in parallel, focusing on building a map of the relevant code, design sketches, and requirement gathering from the user.

### Planning
Once enough information has been gathered to have a clear understanding of the goals, domain, and scope of the project, move on to planning. Using the docs, organize the work into phases in the plan/ directory. Call out any uncertainties that might come up during implementation time, references to docs or project files, and acceptance criteria.

**Plans must live on disk** in `prj/{name}/plan/` as files, never only in conversation. This ensures plans survive context clears and drive the workflow from a single source of truth. If a plan is provided inline, write it to the project's `plan/` directory as phase files first.

### Executing plans
Track the current phase of the plan in `PROJECT.md`, and add a note to the plan file when done as well. The phase is complete when the acceptance criteria in it are met and tests are working. If the phase is impossible/overly scoped, call that out to the user. Add to `WORKLOG.md` when appropriate - have fun with it, that file is yours.

**One phase at a time.** When delegating to the carpenter skill, pass only a single phase file. Do not combine phases or pass multiple phase contents. Complete, review, and mark done before moving on.

#### Reviewing phases
At the end of each phase, before marking as done, send the **inspector** skill to review the changes with a focus on code quality, correctness, and style. Add the review to the phase file, then make the changes as requested by the review. Only after reviewing, mark the phase as done, and commit the changes.

### Completing projects
When all phases of the plan are complete, it is time to verify the project with the user. The **operator** skill can drive the software and attempt to break it. Make sure the user has a way to test it, and provide a paragraph-sized description of the results of the project. If additional work comes up during this period, add an additional phase with the follow-on work and go back to execution, after finishing the verification process.

When the project is actually complete and the user signs off on it, mark it as complete in the catalog and wherever else necessary. Congrats!
