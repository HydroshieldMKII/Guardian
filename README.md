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

### Plex Server Configuration

Configure your connection to the Plex Media Server.

- **Authentication token**: Required for Guardian to communicate with your Plex server. [What is this?](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/)
- **Plex server IP address**: Your Plex server's network address
- **Plex server port**: Your Plex server's port (default `32400`)
- **Enable SSL**: Use SSL for Plex connection
- **Ignore SSL certificate errors (not recommended with public domains or on public networks)**: Ignore SSL certificate errors

### Guardian Configuration

Configure Guardian behavior and monitoring settings.

- **Automatic update checking**: Automatically check for new releases when you open the app. Updates are never applied automatically, you will only be notified if a new version is available
- **Default behavior for new devices**: Block new devices by default. Provides maximum security by requiring manual approval
- **Refresh interval**: Refresh interval for fetching session info and enforcing bans. This as no effect on the dashboard refresh rate. (default: `10` (seconds))
- **Automatic device cleanup**: When enabled, devices that haven't streamed for the specified number of days will be automatically deleted and require approval again. You can specify the inactivity threshold with the setting below
- **Device inactivity threshold (days)**: Number of days a device can be inactive before it's automatically deleted. (default: `30` (days))

### Customization

Customize the user interface, blocking messages, and overall user experience.

- **Show media thumbnails**: Display thumbnails for active streams
- **Show background artwork**: Display background artwork for active streams
- **Custom Plex web URL**: Custom URL for opening Plex content (e.g., https://app.plex.tv). Leave empty to use configured server settings
- **Default page on startup**: Choose which page to display when the app loads
- **Device pending approval message**: Message displayed when a device is waiting for approval
- **Device rejected message**: Message displayed when a device has been rejected
- **LAN-only access message**: Message displayed when only LAN access is allowed
- **WAN-only access message**: Message displayed when only WAN access is allowed
- **IP not allowed message**: Message displayed when the IP address is not in the allowed list 

### Notification Settings

Configure how notifications behave and interact with your workflow.

- **Auto-mark notifications as read**: Automatically mark notifications as read when you click on them

### Database Management

- **Export/Import**: Create JSON backups of all Guardian data (settings, devices, preferences) for migration or recovery. The export contains sensitive information like your Plex token, so handle it securely. It doesnt include include sessions history and notifications. Note that importing a database will only merge data (overwriting existing records or adding new ones) and will not delete any existing records.

### Administrative Tools

- **Reset Stream Counts**: Clears the streams count statistics for all devices while preserving device and settings.
- **Delete All Devices**: Permanently removes all device records from the app. This will delete all device-specific data, notifications and sessions history. Users will need to be re-approved when they next attempt to stream
- **Reset Entire Database**: Completely wipes all Guardian data including settings, devices, user preferences, sessions history and notifications. This returns Guardian to its initial state as if freshly installed. Default settings will be restored and all configuration must be redone. Recommended before importing a backup for a clean install

---

## Updating

Always back up data before updating. You can export your database from the settings page.

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
