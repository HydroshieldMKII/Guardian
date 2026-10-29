# Configuration

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `TRUST_PROXY_HOPS` | `1` | Reverse proxies in front of Guardian; picks the client address in `X-Forwarded-For`. Set `0` when browsers connect to Guardian directly. |
| `APP_URL` | unset | Public URL, for example `https://guardian.example.com`. Required for password reset links. |
| `DATABASE_PATH` | `/app/data/plex-guard.db` | SQLite database file. |

Everything else is set in the web UI.

## Image tags

| Tag | Follows |
| --- | --- |
| `latest` | Every stable release |
| `v2` | Stable releases of a major version |
| `v2.0` | Patch releases of a minor version |
| `v2.0.1` | One exact release |

A patch release ships automatically at most every two weeks. Database migrations run on startup,
so downgrading after one is not supported: restore a settings export instead.
