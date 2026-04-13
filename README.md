# DARKBLUE DRAFTKIT PROJECT

## Main Entry Point

- The active codebase is in [`mvpfinal/`](./mvpfinal)
- The main project README is in [`mvpfinal/README.md`](./mvpfinal/README.md)
- If you want the real app structure, API structure, and current architecture notes, start there

## Live Links

- Draft Kit frontend:
  - `https://dbdraftkit.onrender.com/`
- Valuation API:
  - `https://draftapi.anythingavenue.com/`
- API health check:
  - `https://draftapi.anythingavenue.com/health`
- API licensing / docs site:
  - `https://darkbluevalue.anythingavenue.com/`

## What Lives Where

- `mvpfinal/`
  - current production-facing code
  - includes:
    - `draftkit/`
    - `api/`
    - `api-site/`
- `docs/`
  - client-facing and project-support documentation
- `misc/`
  - archived or reference material that is not required to run the live websites
  - includes older prototypes, design artifacts, archived sprint copies, sample data, and supporting markdown docs

## Runtime-Critical Paths

- Only these paths are needed for the currently deployed products:
  - `mvpfinal/draftkit`
  - `mvpfinal/api`
  - `mvpfinal/api-site`

## Archived / Reference Paths

- These were moved under `misc/` to keep the repo root cleaner:
  - `misc/.claude/`
  - `misc/example/`
  - `misc/figma/`
  - `misc/main/`
  - `misc/sample/`
  - `misc/sprint1/`
  - root-level reference markdown files other than this README

## Local Development

- Frontend:
  - `cd mvpfinal/draftkit`
  - `npm install`
  - `npm run dev`
- API:
  - `cd mvpfinal/api`
  - `npm install`
  - `npm run dev`
- API site:
  - static files live in `mvpfinal/api-site`

## Notes

- If something in this repo looks old, duplicated, or prototype-like, check `misc/` first.
- If something is part of the currently shipped system, it should be under `mvpfinal/`.
