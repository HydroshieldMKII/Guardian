# Guardian

## Commands

```bash
(cd backend  && npm run lint:ci && npm run typecheck && npm run test:cov && npm run build)
(cd frontend && npm run lint:ci && npm run typecheck && npm run test:cov && npm run build)
```

## Rules

- Existing installs must keep working after an update. Schema changes go through a migration.
- Keep changes small and focused, with tests.
- Never commit, push, tag or merge unless asked. Never use `--no-verify`.
- No AI attribution in commits or PRs. PR titles use Conventional Commits.
- No code comments. No `as unknown as T`.
- No personal data in code, tests or fixtures.
