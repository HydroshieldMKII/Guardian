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
> **Do not expose Guardian directly to the internet.** Run it on your LAN, behind a VPN, or behind a reverse proxy with SSO.

## Screenshots

<img width="3024" alt="Guardian device management" src="https://github.com/user-attachments/assets/d0283784-c009-467e-8e38-b0d7f3907ba0" />

<img width="3024" alt="Guardian active streams" src="https://github.com/user-attachments/assets/3c2e9d9b-0836-4e95-913d-fcc71634820f" />

## Features

**Access control** — automatic session termination for unapproved devices, global and per-user rules, IP restrictions by LAN/WAN/CIDR, time-limited temporary access, and per-user schedules.

**Monitoring** — live Plex and Plexamp session tracking, detailed device fingerprints, stream quality and progress, and searchable session history.

**Notifications** — SMTP email and Apprise (100+ services) alerts for new devices, blocks, location changes, and user notes.

**Management** — concurrent stream limits, automatic cleanup of inactive devices, settings export/import, and a self-service portal where Plex users can view their own devices.

## Installation

### Docker

```bash
mkdir -p guardian && cd guardian
curl -o docker-compose.yml https://raw.githubusercontent.com/HydroshieldMKII/Guardian/main/docker-compose.example.yml
curl -o .env https://raw.githubusercontent.com/HydroshieldMKII/Guardian/main/.env.example
docker compose up -d
```

Guardian is then available at `http://localhost:3000`. You will need a [Plex authentication token](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/) to complete setup.

To build from source instead:

```bash
git clone https://github.com/HydroshieldMKII/Guardian.git
cd Guardian
docker compose -f docker-compose.dev.yml up -d --build
```

### Proxmox

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/guardian.sh)"
```

Follow the prompts, then open `http://[CONTAINER-IP]:3000`. See the [community script docs](https://community-scripts.github.io/ProxmoxVE/scripts?id=guardian) for options.

### Unraid

Under **Docker → Compose**, create a stack from `docker-compose.example.yml`, adjust the volume and port if needed, and deploy.

## Updating

> [!IMPORTANT]
> Back up your settings first: **Settings → Admin Tools → Export Database**.

```bash
docker compose pull && docker compose up -d
```

Guardian also works with [Watchtower](https://containrrr.dev/watchtower/) for automatic updates. On Proxmox, run `update` inside the LXC.

### Migrating from the split images

Releases up to v1.3.4 shipped separate `guardian-backend` and `guardian-frontend` images. From v1.3.5 there is a single `hydroshieldmkii/guardian` image. Replace the two services in your `docker-compose.yml` with the one in [`docker-compose.example.yml`](docker-compose.example.yml), pointing the volume at your existing data:

```yaml
services:
  guardian:
    image: hydroshieldmkii/guardian:latest
    ports:
      - "3000:3000"
    volumes:
      - guardian_data:/app/data
    restart: unless-stopped
```

Keep your existing volume name so your database carries over.

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

On Proxmox, run the same scripts from `/opt/guardian/backend/src/scripts/`.

**Cannot connect to Plex** — confirm the server is reachable, the token is valid, and no firewall is in the way.

**Notifications not arriving** — use the test buttons in Settings, then check credentials and your spam folder.

**Logs** — `docker compose logs -f guardian`, or `journalctl -u guardian -f` on Proxmox.

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

CI runs the same checks plus a container build on every pull request to `main`. Releases publish the multi-arch image to Docker Hub.

## Contributing

Bug reports, feature ideas, documentation fixes, and pull requests are all welcome. Please make sure CI passes before requesting review.
