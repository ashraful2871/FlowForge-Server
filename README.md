# FlowForge Server

Multi-tenant project management API with a dependency-aware planning engine.
Built step by step as a learning and portfolio project.

> Status: **R0 Foundation** complete — server, config, logging, errors, database, tests, CI.

## Tech stack

| Tool                      | Why                                                   |
| ------------------------- | ----------------------------------------------------- |
| Node.js 24 + TypeScript 6 | Type-safe backend on the current LTS                  |
| Express 5                 | Async errors reach the error handler without wrappers |
| PostgreSQL 18 + Prisma 7  | Relational data with typed queries and migrations     |
| Zod                       | Validates environment variables and request input     |
| Pino                      | Structured JSON logs with a request ID on every line  |
| Vitest + Supertest        | Fast tests against the real app, no port needed       |
| tsup                      | Bundles the server for production                     |
| Docker Compose            | Same database for everyone, one command               |
| GitHub Actions            | Lint, typecheck, test and build on every push         |

## Prerequisites

- Node.js 24
- Docker Desktop (running)

## Setup

```bash
git clone https://github.com/ashraful2871/FlowForge-Server.git
cd FlowForge-Server

docker compose up -d

cp .env.example .env
cp .env.example .env.test
# In .env.test: NODE_ENV=test, LOG_LEVEL=silent, database name flowforge_test

npm install
npm run db:migrate
npm run db:migrate:test

npm run dev        # http://localhost:5000/health
npm test
```

## Scripts

| Script               | What it does                                 |
| -------------------- | -------------------------------------------- |
| `npm run dev`        | Start the server with auto-reload            |
| `npm test`           | Run the test suite against the test database |
| `npm run lint`       | ESLint with type-aware rules                 |
| `npm run typecheck`  | TypeScript type check                        |
| `npm run build`      | Bundle to `dist/`                            |
| `npm start`          | Run the built server                         |
| `npm run db:migrate` | Create and apply migrations (dev)            |
| `npm run db:studio`  | Browse the database                          |

## Endpoints

| Method | Path      | Description                        |
| ------ | --------- | ---------------------------------- |
| GET    | `/health` | Process is alive                   |
| GET    | `/ready`  | Database is reachable (503 if not) |

All errors use one shape:

```json
{ "error": { "code": "NOT_FOUND", "message": "…", "requestId": "…" } }
```

## Project structure

```text
src/
├── app.ts           Express app (no port)
├── server.ts        Starts the server, graceful shutdown
├── config.ts        Validated environment
├── lib/             db, logger, errors
├── middleware/      request logger, 404, error handler
├── modules/         features (from R1)
└── routes/          health
tests/               Vitest + Supertest
```

## Roadmap

- [x] R0 Foundation
- [ ] R1 Auth and multi-tenant organizations
- [ ] R2 Projects, tasks, comments
- [ ] R3 Dependencies, critical path, what-if planning
- [ ] R4 Web app
- [ ] R5 Verified AI explanations, v1.0 release
- [ ] R6 Billing and document search
