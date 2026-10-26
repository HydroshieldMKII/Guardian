# Contributing

## Setup

```bash
git clone https://github.com/HydroshieldMKII/Guardian.git && cd Guardian
git config core.hooksPath .githooks
```

In two terminals: `cd backend && npm ci && npm run start:dev` (port 3001) and
`cd frontend && npm ci && npm run dev` (port 3000).

## Before a pull request

```bash
(cd backend  && npm run lint:ci && npm run typecheck && npm run test:cov && npm run build)
(cd frontend && npm run lint:ci && npm run typecheck && npm run test:cov && npm run build)
```

## Guidelines

- Keep changes small and focused, with tests.
- Existing installs must keep working after an update. Schema changes go through a migration.
- PR titles use Conventional Commits (`feat:`, `fix:`, ...).
- No personal data in code, tests or fixtures.

Report security issues through a
[private advisory](https://github.com/HydroshieldMKII/Guardian/security/advisories/new).
