# Main Coordination Folder

This folder is the project-management entry point for the current planning pass.

## What belongs here
- A human-readable summary of the current project state
- Sprint planning references
- Links back to the real build and canonical docs

## Canonical Latest Build
- The latest working build remains in `../mvpfinal/`
- It is not moved into this folder during this pass because changing the code layout would create unnecessary deployment risk

## Key References
- `../README.md` for the repo-wide product overview
- `../MASTER_MVP.md` for the scope contract
- `../CURRENT.md` for the latest state snapshot
- `../JIRA.md` for the detailed sprint and board plan
- `../DEPLOY.md` and `../docs/API.md` for deployment/API reality checks
- `../sprint1/` as a sprint snapshot/reference copy, not the canonical production source of truth

## Sprint Split Summary
- Sprint 1: stabilize live deployment, licensing UX, and state-sync reliability
- Sprint 2: finish the most visible competitive-edge features
- Sprint 3: complete polish, exports, and final regression cleanup

## Team Load Rule
- Daniel, Hugh, Matt, and Zaber each take one story per sprint for Sprints 1 through 3
- Work is balanced by story count rather than frontend/backend specialization
