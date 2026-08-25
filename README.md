# Guardian

[![CI](https://github.com/HydroshieldMKII/Guardian/actions/workflows/ci.yml/badge.svg)](https://github.com/HydroshieldMKII/Guardian/actions/workflows/ci.yml)
[![CD](https://github.com/HydroshieldMKII/Guardian/actions/workflows/cd.yml/badge.svg)](https://github.com/HydroshieldMKII/Guardian/actions/workflows/cd.yml)
[![Docker Pulls](https://img.shields.io/docker/pulls/hydroshieldmkii/guardian.svg)](https://hub.docker.com/r/hydroshieldmkii/guardian)
[![Stars](https://img.shields.io/github/stars/HydroshieldMKII/Guardian.svg?style=flat)](https://github.com/HydroshieldMKII/Guardian/stargazers)
[![Discord](https://img.shields.io/discord/1415505445883215955?logo=discord&label=Discord)](https://discord.gg/xTKuHyhdS4)

![Guardian Banner](https://github.com/user-attachments/assets/ff8b9bbc-f5d4-451a-bdc1-cb2354023c8b)

Guardian is a security and management platform for Plex Media Server. It monitors streaming activity, enforces granular access controls, and ensures only authorized devices can reach your library.

> [!WARNING]
> **Looking for a maintainer.** This project is feature-complete from the author's perspective. No new features are planned unless someone steps up to take the lead, and security patches may be slow. Interested? Reach out on [Discord](https://discord.gg/xTKuHyhdS4) or in [Discussions](https://github.com/HydroshieldMKII/Guardian/discussions).
>
> **In the mean time, do not expose Guardian directly to the internet.** Run it on your LAN, behind a VPN, or behind a reverse proxy with SSO.

## Screenshots

<img width="3024" alt="Guardian device management" src="https://github.com/user-attachments/assets/d0283784-c009-467e-8e38-b0d7f3907ba0" />

<img width="3024" alt="Guardian active streams" src="https://github.com/user-attachments/assets/3c2e9d9b-0836-4e95-913d-fcc71634820f" />

## Features

**Access control**: automatic session termination for unapproved devices, global and per-user rules, IP restrictions by LAN/WAN/CIDR over both IPv4 and IPv6, time-limited temporary access, and per-user schedules.

**Monitoring**: live Plex and Plexamp session tracking, detailed device fingerprints, stream quality and progress, and searchable session history.

**Notifications**: SMTP email and Apprise (100+ services) alerts for new devices, blocks, location changes, and user notes.

**Management**: concurrent stream limits, automatic cleanup of inactive devices, settings export/import, and a self-service portal where Plex users can view their own devices.

## Installation

### Docker

```bash
mkdir -p guardian && cd guardian
curl -o docker-compose.yml https://raw.githubusercontent.com/HydroshieldMKII/Guardian/main/docker-compose.example.yml
docker compose up -d
```

Webui is then available at `http://localhost:3000` by default.

To build from source instead:

```bash
git clone https://github.com/HydroshieldMKII/Guardian.git
cd Guardian
docker compose -f docker-compose.dev.yml up -d --build
```

### Unraid

Under **Docker -> Compose**, create a stack from `docker-compose.example.yml`, adjust the volume and port if needed, and deploy.

## Configuration

### Plex token

You will need a [Plex authentication token](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/) to complete setup.

### Running behind a reverse proxy

`TRUST_PROXY_HOPS` sets how many proxies sit in front of Guardian. Defaults to `1`.

```yaml
services:
  guardian:
    environment:
      - TRUST_PROXY_HOPS=1
```

Use `2` for Cloudflare in front of your own proxy, or `0` when nothing is in front. A wrong value will break IP policies and rate limiting.

## Updating

> [!IMPORTANT]
> Back up your settings first: **Settings → Admin Tools → Export Database**.

```bash
docker compose pull && docker compose up -d
```

Guardian also works with [Watchtower](https://containrrr.dev/watchtower/) for automatic updates. 

## Troubleshooting

**Lost admin access** — reset credentials from the CLI:

```bash
docker compose exec guardian node backend/src/scripts/list-admins.js
docker compose exec guardian node backend/src/scripts/update-admin.js "USERNAME" "NEW_PASSWORD"
```

**Locked out by captcha** — clear the Turnstile keys:

```bash
docker compose exec guardian node backend/src/scripts/disable-captcha.js
```

**Cannot connect to Plex** — confirm the server is reachable, the token is valid, and no firewall is in the way.

**Notifications not arriving** — use the test buttons in Settings, then check credentials and your spam folder.

Still stuck? Ask on [Discord](https://discord.gg/xTKuHyhdS4) or open an [issue](https://github.com/HydroshieldMKII/Guardian/issues).

## Development

```bash
cd backend  && npm ci && npm run start:dev
cd frontend && npm ci && npm run dev
```

Before opening a pull request:

```bash
cd backend  && npm run lint:ci && npm run test:cov && npm run build
cd frontend && npm run typecheck && npm run test:cov && npm run build
```

## Contributing

Bug reports, feature ideas, documentation fixes, and pull requests are all welcome. Please make sure CI passes before requesting review.
