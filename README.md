# Guardian

[![Build](https://github.com/HydroshieldMKII/Guardian/actions/workflows/docker-multiarch.yml/badge.svg)](https://github.com/HydroshieldMKII/Guardian/actions/workflows/docker-multiarch.yml)
[![Docker Pulls](https://img.shields.io/docker/pulls/hydroshieldmkii/guardian-frontend.svg)](https://hub.docker.com/r/hydroshieldmkii/guardian-frontend)
[![Stars](https://img.shields.io/github/stars/HydroshieldMKII/Guardian.svg?style=flat)](https://github.com/HydroshieldMKII/Guardian/stargazers)
[![Need help or feedback?](https://img.shields.io/discord/1415505445883215955?logo=discord&label=Need%20help%20or%20feedback?)](https://discord.gg/xTKuHyhdS4)

**Guardian** is a utility that enhances the security and management of your Plex Media Server.  
It helps you monitor activity, control device access, and ensure only authorized users can stream from your library.

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
  - [Docker (Recommended)](#docker-recommended)
  - [Unraid](#unraid)
- [Configuration](#configuration)
- [Application Settings](#application-settings)
- [Updating](#updating)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

<img width="1280" height="599" alt="Guardian" src="https://github.com/user-attachments/assets/f2ab7b82-d589-45db-98de-ff0fb6c01bd1" />

## Features

### Device Security & Access Control

- Automatic session termination for unapproved devices
- Per-user default blocking rules
- Global default blocking for new devices

### Real-time Monitoring & Tracking

- Live session tracking (Plex and Plexamp)
- Device details: platform, product, version, IP address, last seen
- Active stream monitoring: title, quality, duration

### Configuration & Flexibility

- Adjustable monitoring intervals
- SSL/TLS support
- Database export and import for backup and migration

---

## Installation

### Docker (Recommended)

**Prerequisites**

- Docker and Docker Compose installed
- Plex Media Server running
- Plex authentication token

**Steps**

1. Clone the repository:
   ```bash
   git clone https://github.com/HydroshieldMKII/Guardian.git
   cd Guardian
   ```
2. Copy configuration:
   ```bash
   cp docker-compose.example.yml docker-compose.yml
   cp .env.example .env   # optional customizations
   ```
3. Start the services:
   ```bash
   docker compose up -d
   ```
4. Access Guardian:
   - Default: [http://localhost:3000](http://localhost:3000)
   - Or via your server’s IP: `http://DEVICE-IP:3000`

---

### Unraid

**Prerequisites**

- Running Unraid server
- Compose Manager plugin installed

**Steps**

1. Create a new stack in _Docker → Compose_.
2. Edit the stack and paste in `docker-compose.example.yml`.
3. Adjust volumes and ports if needed. For example:

   ```yaml
   volumes:
     - /mnt/user/appdata/guardian:/app/data

   ports:
     - "3456:3000"
   ```

   Guardian will then be available at `http://[UNRAID-IP]:3456`.

4. Deploy with _Compose Up_.

---

## Configuration

Guardian supports optional environment variables in `.env`:

- `PLEXGUARD_FRONTEND_PORT`: Frontend port (default `3000`)
- `VERSION`: Docker image version (default `latest`, or use e.g. `v1.2.3`)

Apply changes by recreating containers:

```bash
docker compose up -d --force-recreate
```

---

## Application Settings

Guardian is configurable via its web interface. Access the Settings page to customize behavior for your specific needs.

### Plex Integration

- **Server IP/Port**: Your Plex server's network address and port. (default port `32400`)
- **Authentication Token**: Required for Guardian to communicate with your Plex server. [What is this?](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/)
- **SSL/TLS Options**: Enable secure HTTPS connections and certificate validation. Only needed if your Plex server requires HTTPS

### Guardian Behavior

- **Device Management**: Default action when new devices attempt to stream. `Block` provides maximum security by requiring manual approval
- **Session Monitoring**: How often to update sessions and enforce rules with your Plex server. Lower values provide faster blocking but use more resources. It has no impact on how often the dashboard refreshes. Default: `10s`
- **Default Page**: Choose which page loads when opening Guardian
- **Blocked User Message**: Customize the message shown to blocked users when their stream is terminated
- **Maintenance & Updates**: Automatically check for new Guardian releases when the app loads. Updates are never installed automatically and will only show a notification when a new version is available

### Device Cleanup

- **Automatic Cleanup**: Removes devices that haven't streamed for a specified period, keeping your device list clean and relevant
- **Inactivity Threshold**: Number of days without streaming activity before a device is automatically removed. Device will lose all settings and data (default: 30 days)

### Database Management

- **Export/Import**: Create JSON backups of all Guardian data (settings, devices, preferences) for migration or disaster recovery. The export contains sensitive information, so handle it securely.
- **Administrative Tools**: Dangerous operations that permanently modify your database - reset entire database, clear stream counts, or delete all device records

---

## Updating

Always back up data before updating.

```bash
docker compose pull
docker compose up -d
```

---

## Troubleshooting

- Verify Plex is running and reachable
- Confirm Plex token is valid
- Check logs for details:

```bash
docker compose ps
docker compose logs -f backend
```

If issues persist, open an issue on [GitHub](https://github.com/HydroshieldMKII/Guardian/issues).

---

## Contributing

Contributions are welcome. Please open issues or submit pull requests with improvements.
