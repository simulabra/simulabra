# workspace-split

Split the simulabra monorepo into independent repos under a bun workspace (`simulabra-world`). Extract agenda, swyperloom, demos, and sps into sibling repos. Build sgit for multi-repo git operations. Preserve git history via filter-repo.

## Tags
infrastructure, workspace, git, tooling

## Status
NOT STARTED

## Phases
- [ ] Phase 1: Prerequisites and workspace foundation
- [ ] Phase 2: Extract repos with git filter-repo
- [ ] Phase 3: Wire workspace, fix imports, verify
- [ ] Phase 4: Clean core (remove extracted directories)
- [ ] Phase 5: Build sgit
- [ ] Phase 6: Agent config and CLAUDE.md decomposition

## Safety Invariant
At every phase boundary the system must be functional. Phases 1-3 are purely additive — core stays intact. Phase 4 is the only destructive step and only runs after Phase 3 verification passes. A backup branch is created before Phase 4 begins.

## History
- 2026-02-17: Project initialized. Design doc written (design.md). Decisions: workspace name is simulabra-world, sgit lives in core/bin/, configured via sgit.json in world dir.
