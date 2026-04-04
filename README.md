# Flight Tracker at Home

A real-time aviation dashboard showing aircraft over London airspace with
Heathrow arrival tracking — built as a portfolio project.

- **Frontend:** React + Vite + Tailwind in `apps/frontend`
- **Backend:** FastAPI in `apps/backend`

## Project docs

- **[docs/MVP.md](./docs/MVP.md)** — Product spec, scope, and risks
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** — Technical decisions, data contract, and stack

## Tooling at a glance

| Tool | What it does here | Docs |
| --- | --- | --- |
| **mise** | Installs the runtimes this repo expects: Bun, Node, Python, and uv. It also gives us shared setup commands. | <https://mise.jdx.dev> |
| **bun** | Installs and runs the JavaScript/TypeScript side of the repo. Think of it as the JS package manager/runtime. | <https://bun.sh/docs> |
| **uv** | Installs Python dependencies and manages the backend virtual environment. Think of it as the Python package manager for this repo. | <https://docs.astral.sh/uv/> |
| **Nx** | Runs repo tasks from one place. It is the monorepo task runner, so you use it to start apps, run tests, and so on. | <https://nx.dev> |
| **Vite** | Dev server and build tool for the React frontend. | <https://vite.dev/guide/> |
| **FastAPI** | Python web framework used by the backend API. | <https://fastapi.tiangolo.com> |

## How the tools fit together

1. `mise` gets the right runtimes onto your machine.
2. `bun` installs JavaScript dependencies from the root of the repo.
3. `uv` installs Python dependencies for `apps/backend` and creates `.venv`.
4. `Nx` is the main way to run project commands after setup.

## Typical setup

```sh
mise install
mise run setup
```

That runs:

- `bun install` for the JS workspace
- `cd apps/backend && uv sync` for the Python backend

## API contract generation

The frontend API client is generated from the FastAPI OpenAPI schema with Orval:

```sh
bun run generate:api
```

That exports `apps/backend`'s OpenAPI schema and regenerates the frontend client in
`apps/frontend/src/api/`.

## Typical commands

```sh
mise run dev
```

Or with Bun/Nx directly:

```sh
bun run dev
```

That starts the frontend on `http://localhost:4200` and the backend on
`http://localhost:8000`.

Other useful commands:

```sh
bunx nx show projects
bunx nx serve backend
bunx nx serve frontend
```

## Lockfiles

- `bun.lock` pins JS dependency versions
- `apps/backend/uv.lock` pins Python dependency versions

If you are new to the repo, start with **mise**, then **bun/uv**, then **Nx**.
