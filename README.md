# FlowForge Server

Multi-tenant project management API with a dependency-aware planning engine.
Built step by step as a learning and portfolio project.

> Status: **R1 Auth and organizations** complete: sessions, roles, invitations,
> password reset, audit log, and a tenant isolation test suite. 169 tests.

## Tech stack

| Tool                      | Why                                                   |
| ------------------------- | ----------------------------------------------------- |
| Node.js 24 + TypeScript 6 | Type-safe backend on the current LTS                  |
| Express 5                 | Async errors reach the error handler without wrappers |
| PostgreSQL 18 + Prisma 7  | Relational data with typed queries and migrations     |
| Zod                       | Validates environment variables and request input     |
| argon2id                  | Password hashing                                      |
| express-rate-limit        | Per-IP and per-email limits on auth routes            |
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

In development, invitation and password reset links are printed to the server
log (`inviteUrl`, `resetUrl`). Email delivery comes in a later release.

## Scripts

| Script                    | What it does                                 |
| ------------------------- | -------------------------------------------- |
| `npm run dev`             | Start the server with auto-reload            |
| `npm test`                | Run the test suite against the test database |
| `npm run lint`            | ESLint with type-aware rules                 |
| `npm run typecheck`       | TypeScript type check                        |
| `npm run build`           | Bundle to `dist/`                            |
| `npm start`               | Run the built server                         |
| `npm run db:migrate`      | Create and apply migrations (dev)            |
| `npm run db:migrate:test` | Apply migrations to the test database        |
| `npm run db:studio`       | Browse the database                          |

## API

Base path: `/api/v1`. Authentication is a session cookie (`ff_session`).
Every `POST`, `PATCH` and `DELETE` must send an allowed `Origin` header.

### Health

| Method | Path      | Description                        |
| ------ | --------- | ---------------------------------- |
| GET    | `/health` | Process is alive                   |
| GET    | `/ready`  | Database is reachable (503 if not) |

### Auth

| Method | Path                           | Auth | Description                                          |
| ------ | ------------------------------ | ---- | ---------------------------------------------------- |
| POST   | `/auth/register`               | –    | Create an account and log in                         |
| POST   | `/auth/login`                  | –    | Log in                                               |
| POST   | `/auth/logout`                 | ✓    | End this session                                     |
| POST   | `/auth/logout-all`             | ✓    | End every session of this user                       |
| POST   | `/auth/password-reset/request` | –    | Always 202; creates a reset link if the email exists |
| POST   | `/auth/password-reset/confirm` | –    | Set a new password and end every session             |
| GET    | `/me`                          | ✓    | Current user and their organizations                 |

### Organizations

`:orgId` routes require an active membership. Non-members get 404.

| Method | Path                              | Role                          | Description                      |
| ------ | --------------------------------- | ----------------------------- | -------------------------------- |
| POST   | `/orgs`                           | any user                      | Create; the creator is OWNER     |
| GET    | `/orgs`                           | any user                      | My organizations                 |
| GET    | `/orgs/:orgId`                    | member                        | Organization and my role         |
| PATCH  | `/orgs/:orgId`                    | OWNER, ADMIN                  | Rename                           |
| DELETE | `/orgs/:orgId`                    | OWNER                         | Delete with everything in it     |
| GET    | `/orgs/:orgId/members`            | member                        | List members                     |
| PATCH  | `/orgs/:orgId/members/:userId`    | OWNER, ADMIN                  | Change role (not to OWNER)       |
| DELETE | `/orgs/:orgId/members/:userId`    | OWNER, ADMIN; anyone for self | Remove, or leave                 |
| POST   | `/orgs/:orgId/transfer-ownership` | OWNER                         | New OWNER; old one becomes ADMIN |

### Invitations

| Method | Path                           | Role         | Description                         |
| ------ | ------------------------------ | ------------ | ----------------------------------- |
| POST   | `/orgs/:orgId/invitations`     | OWNER, ADMIN | Invite by email (7-day link)        |
| GET    | `/orgs/:orgId/invitations`     | OWNER, ADMIN | Open invitations                    |
| DELETE | `/orgs/:orgId/invitations/:id` | OWNER, ADMIN | Revoke                              |
| POST   | `/invitations/accept`          | logged in    | Accept with the token from the link |

### Errors

Every error has one shape:

```json
{ "error": { "code": "NOT_FOUND", "message": "…", "requestId": "…" } }
```

| Status | Codes                                                                         |
| ------ | ----------------------------------------------------------------------------- |
| 400    | `BAD_REQUEST`, `INVALID_TOKEN`                                                |
| 401    | `UNAUTHENTICATED`, `INVALID_CREDENTIALS`                                      |
| 403    | `FORBIDDEN`, `CSRF_REJECTED`, `EMAIL_MISMATCH`                                |
| 404    | `NOT_FOUND`                                                                   |
| 409    | `EMAIL_TAKEN`, `SLUG_TAKEN`, `LAST_OWNER`, `ALREADY_MEMBER`, `INVITE_PENDING` |
| 410    | `INVITE_EXPIRED_OR_USED`                                                      |
| 422    | `VALIDATION_ERROR` (with `fields`)                                            |
| 429    | `RATE_LIMITED`                                                                |

## Security design

| Concern            | How it is handled                                                                             | ADR                                                 |
| ------------------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Sessions           | Opaque token in an httpOnly cookie, only its hash in the database; idle and absolute timeouts | [0001](docs/adr/0001-database-sessions-over-jwt.md) |
| Passwords          | argon2id, minimum 10 characters, common passwords rejected                                    | –                                                   |
| Login              | Same error for unknown email and wrong password, constant-time check, rate limits             | –                                                   |
| Tenant isolation   | 404 for non-members; every query filtered by the actor's organization                         | [0002](docs/adr/0002-not-found-for-non-members.md)  |
| Roles              | One permission matrix; ADMIN cannot touch OWNER; always one OWNER                             | [0003](docs/adr/0003-role-policy-matrix.md)         |
| Audit              | Written in the same transaction; survives deletion                                            | [0004](docs/adr/0004-audit-log.md)                  |
| Invite/reset links | Hashed, single-use, short-lived, claimed atomically                                           | [0005](docs/adr/0005-single-use-hashed-tokens.md)   |
| CSRF               | Exact `Origin` match on every state-changing request                                          | [0006](docs/adr/0006-csrf-origin-check.md)          |

## Testing

169 tests run against a real PostgreSQL database (`flowforge_test`), emptied
before each test.

| Suite                            | What it covers                                              |
| -------------------------------- | ----------------------------------------------------------- |
| `src/lib/*.test.ts`              | Password rules, tokens, the full 56-cell role matrix        |
| `src/modules/auth/auth.test.ts`  | Register, sessions, login, logout, origin check, reset      |
| `src/modules/orgs/orgs.test.ts`  | Organizations, membership, roles, ownership                 |
| `src/modules/invitations/…`      | Invite, revoke, accept, replay and email binding            |
| `tests/tenant-isolation.test.ts` | Org A's owner tries every Org B endpoint: 404 and no change |

## Known limitations

- Emails are not sent yet; links are logged in development.
- Two owners demoting each other at the same instant could leave no owner
  (Read Committed isolation). Fix: serializable transaction or row lock.
- Expired and revoked sessions are not cleaned up yet.
- Non-browser clients must send an `Origin` header; token auth comes later.

## Project structure

```text
src/
├── app.ts              Express app (no port)
├── server.ts           Starts the server, graceful shutdown
├── config.ts           Validated environment
├── lib/                db, logger, errors, password, token, policy, audit
├── middleware/         session, membership, origin check, rate limits
├── modules/
│   ├── auth/           register, login, sessions, password reset
│   ├── orgs/           organizations, members, ownership
│   └── invitations/    invite, revoke, accept
└── routes/             API router, health
tests/
├── helpers/            agent, database reset, seed data
└── tenant-isolation.test.ts
docs/adr/               Architecture decision records
```

## Roadmap

- [x] R0 Foundation
- [x] R1 Auth and multi-tenant organizations
- [ ] R2 Projects, tasks, comments
- [ ] R3 Dependencies, critical path, what-if planning
- [ ] R4 Web app
- [ ] R5 Verified AI explanations, v1.0 release
- [ ] R6 Billing and document search
