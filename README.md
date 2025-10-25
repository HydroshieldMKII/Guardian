# Guardian

[![Build](https://github.com/HydroshieldMKII/Guardian/actions/workflows/docker-multiarch.yml/badge.svg)](https://github.com/HydroshieldMKII/Guardian/actions/workflows/docker-multiarch.yml)
[![Docker Pulls](https://img.shields.io/docker/pulls/hydroshieldmkii/guardian-frontend.svg)](https://hub.docker.com/r/hydroshieldmkii/guardian-frontend)
[![Stars](https://img.shields.io/github/stars/HydroshieldMKII/Guardian.svg?style=flat)](https://github.com/HydroshieldMKII/Guardian/stargazers)
[![Discord](https://img.shields.io/discord/1415505445883215955?logo=discord&label=Discord)](https://discord.gg/xTKuHyhdS4)

![Guardian Banner](https://github.com/user-attachments/assets/ff8b9bbc-f5d4-451a-bdc1-cb2354023c8b)

> **Guardian** is a security and management platform for Plex Media Server. Monitor streaming activity, enforce granular access controls, and ensure only authorized devices can access your media library.

---

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Installation](#installation)
  - [Docker (Recommended)](#docker-recommended)
  - [Proxmox](#proxmox)
  - [Unraid](#unraid)
- [Configuration](#configuration)
- [Application Settings](#application-settings)
- [Updating](#updating)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## Features

### Device Security & Access Control

- **Automatic Session Termination** - Block unapproved devices instantly
- **Flexible Access Rules** - Global and per-user blocking configurations
- **IP-Based Controls** - Restrict access by LAN, WAN, or specific IP/CIDR ranges
- **Temporary Access** - Grant time-limited device permissions
- **Schedule-Based Restrictions** - Define custom access schedules per user

### Real-time Monitoring & Tracking

- **Live Session Tracking** - Monitor Plex and Plexamp streams in real-time
- **Detailed Device Information** - Platform, product, version, IP address, and last seen
- **Stream Analytics** - Track title, quality, duration, and progress
- **Session History** - Logging with filtering and search

### Notifications & Alerts

- **SMTP Email Integration** - Real-time notifications for security events
- **Apprise Support** - Send alerts to 100+ services (Discord, Slack, Telegram, etc.)
- **Customizable Triggers** - Configure alerts for new devices, blocks, and more
- **Secure Delivery** - TLS/STARTTLS encryption and authentication support

### User Interface & Experience

- **Customizable Messages** - Tailor blocking messages for different scenarios
- **Rich Media Display** - Thumbnails and background artwork for active streams
- **Theme Support** - Modern dark/light mode
- **Responsive Design** - Optimized for mobile and desktop
- **Custom Plex Integration** - Seamless content access with custom URLs

### Configuration & Management

- **Adjustable Monitoring** - Configure refresh intervals to suit your needs
- **SSL/TLS Support** - Secure connections with certificate validation controls
- **Database Management** - Export and import for backup and migration
- **Automatic Cleanup** - Remove inactive devices based on inactivity periods
- **Administrative Tools** - Database management from the UI
- **Update Management** - Automatic update checking with version mismatch detection

---

## Screenshots

<img width="3024" alt="Guardian Dashboard - Device Management" src="https://github.com/user-attachments/assets/d0283784-c009-467e-8e38-b0d7f3907ba0" />

<img width="3024" alt="Guardian Dashboard - Active Streams" src="https://github.com/user-attachments/assets/3c2e9d9b-0836-4e95-913d-fcc71634820f" />

## Installation

### Docker (Recommended)

**Prerequisites**

- Docker and Docker Compose installed
- Plex Media Server running and accessible
- Plex authentication token ([How to find your token](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/))

**Quick Start**

```bash
# Clone the repository
git clone https://github.com/HydroshieldMKII/Guardian.git
cd Guardian

# Copy configuration files
cp docker-compose.example.yml docker-compose.yml
cp .env.example .env  # Optional: customize settings

# Start Guardian
docker compose up -d
```

**Access Guardian**

- Local: [http://localhost:3000](http://localhost:3000)
- Remote: `http://YOUR-SERVER-IP:3000`

---

### Proxmox

Deploy Guardian in a lightweight LXC container using the community script.

**Prerequisites**

- Proxmox VE server
- Plex Media Server running and accessible
- Plex authentication token

**Installation**

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/guardian.sh)"
```

Follow the interactive prompts, then access Guardian at `http://[CONTAINER-IP]:3000`.

> **Note:** For detailed Proxmox configuration options, see the [community script documentation](https://community-scripts.github.io/ProxmoxVE/scripts?id=guardian).

---

### Unraid

**Prerequisites**

- Unraid server
- Compose Manager plugin installed

**Installation Steps**

1. Navigate to **Docker → Compose**
2. Create a new stack
3. Paste the contents of `docker-compose.example.yml`
4. Customize volumes and ports (optional):

   ```yaml
   volumes:
     - /mnt/user/appdata/guardian:/app/data

   ports:
     - "3456:3000"
   ```

5. Deploy with **Compose Up**
6. Access at `http://[UNRAID-IP]:3456`

---

## Configuration

Guardian can be configured through environment variables or the web interface.

### Environment Variables

Create a `.env` file to customize deployment settings:

| Variable | Description | Default | Applies To |
|----------|-------------|---------|------------|
| `PLEXGUARD_FRONTEND_PORT` | Web interface port | `3000` | Docker, Proxmox, Unraid |
| `VERSION` | Docker image version | `latest` | Docker, Unraid |

**Example `.env` file:**

```bash
PLEXGUARD_FRONTEND_PORT=3456
VERSION=v1.2.3
```

### File Locations

- **Docker**: Place `.env` in the same directory as `docker-compose.yml`
- **Proxmox**: Place `.env` at `/opt/guardian/.env` inside the LXC

### Applying Changes

**Docker:**

```bash
docker compose up -d --force-recreate
```

**Proxmox:**

```bash
systemctl restart guardian-backend guardian-frontend
```

> **Important:** Most configuration is done through Guardian's web interface. Environment variables are primarily for deployment customization.

---

## Application Settings

Configure Guardian through the web interface Settings page.

### Plex Integration

Connect Guardian to your Plex Media Server.

| Setting | Description |
|---------|-------------|
| **Plex Server IP** | IP address or hostname of your Plex server |
| **Plex Server Port** | Port number (default: `32400`) |
| **Authentication Token** | Required for Guardian to communicate with Plex ([Find your token](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/)) |
| **Use SSL/HTTPS** | Enable secure connection to Plex |
| **Ignore SSL Errors** | Skip certificate validation (not recommended for production) |
| **Custom Plex URL** | Override default Plex URL for media links (e.g., `https://app.plex.tv`) |

### Guardian Configuration

Core behavior and monitoring settings.

| Setting | Description | Default |
|---------|-------------|---------|
| **Auto-Check Updates** | Automatically check for new Guardian releases on startup | Enabled |
| **Block New Devices** | Require manual approval for all new devices | Enabled |
| **Refresh Interval** | Session monitoring frequency (seconds) | `10` |
| **Auto Device Cleanup** | Remove inactive devices automatically | Disabled |
| **Inactivity Threshold** | Days before inactive devices are removed | `30` |
| **Timezone** | UTC offset for time-based restrictions (e.g., `+00:00`) | `+00:00` |

### Customization

Personalize the user interface and experience.

| Setting | Description |
|---------|-------------|
| **Default Page** | Starting page on app load (`Devices` or `Streams`) |
| **Show Thumbnails** | Display media thumbnails in active streams |
| **Show Artwork** | Display background artwork for streams |

#### Custom Messages

Customize blocking messages for different scenarios:

| Message Type | Description |
|--------------|-------------|
| **Pending Approval** | Displayed when a device awaits approval |
| **Device Rejected** | Shown when a device has been rejected |
| **LAN Only** | Displayed for LAN-only access restrictions |
| **WAN Only** | Shown for WAN-only access restrictions |
| **IP Not Allowed** | Displayed when IP is not in allowed list |
| **Time Restricted** | Shown when time schedule conditions aren't met |

### Notification Settings

Configure how notifications behave.

| Setting | Description |
|---------|-------------|
| **Auto-Mark Read** | Automatically mark notifications as read when clicked |

#### Email Notifications (SMTP)

| Setting | Description |
|---------|-------------|
| **Enable Email** | Enable SMTP notification system |
| **Notify on New Device** | Email alerts for newly detected devices |
| **Notify on Block** | Email alerts for blocked streams |
| **SMTP Host** | Hostname or IP of your SMTP server (e.g., `smtp.gmail.com`) |
| **SMTP Port** | Port number (587 for TLS, 465 for SSL, 25 for unencrypted) |
| **SMTP Username** | Authentication username |
| **SMTP Password** | Authentication password |
| **Use TLS** | Enable TLS/STARTTLS encryption |
| **From Email** | Sender email address |
| **From Name** | Sender display name (e.g., `Guardian Notifications`) |
| **To Emails** | Recipient addresses (comma or semicolon separated) |

#### Apprise Notifications

Send notifications to 100+ services including Discord, Slack, Telegram, Pushover, and more.

| Setting | Description |
|---------|-------------|
| **Enable Apprise** | Enable Apprise notification system |
| **Notify on New Device** | Apprise alerts for newly detected devices |
| **Notify on Block** | Apprise alerts for blocked streams |
| **Service URLs** | Notification service URLs (one per line, comma, or semicolon separated) |

> **Note:** Each service has a specific URL format. View the [Apprise documentation](https://github.com/caronc/apprise/wiki) for service URL formats and configuration examples.

### Admin Tools

#### Database Management

Backup and restore your Guardian configuration.

| Action | Description |
|--------|-------------|
| **Export Database** | Download JSON backup of settings, devices, and preferences |
| **Import Database** | Restore from a previous backup (merges with existing data) |

> **Warning:** Exports contain sensitive information including your Plex authentication token, SMTP credentials or Apprise crendentials. Store backups securely. Import operations create or overwrite current records and do not delete any records.

#### Administrative Tools & Dangerous Operations

> **Caution:** These operations can permanently modify or delete data. Always export your database before performing administrative operations.

| Tool | Description | Impact |
|------|-------------|--------|
| **Reset Stream Counts** | Clear session statistics | Preserves devices and settings |
| **Clear Session History** | Delete all session history records | Cannot be undone |
| **Delete All Devices** | Remove all device records | Users need re-approval, deletes notifications and history |
| **Reset Database** | Complete database wipe | Restores default settings, cannot be undone |

---

## Updating

> **Important:** Always backup your database before updating (Settings → Admin Tools → Export Database).

### Docker

**Manual Update:**

```bash
docker compose pull
docker compose up -d
```

**Automated Updates with Watchtower:**

Guardian works seamlessly with [Watchtower](https://containrrr.dev/watchtower/) for automatic updates.

### Proxmox

Update from the LXC console:

```bash
# Method 1
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/guardian.sh)" -u

# Method 2
update
```

---

## Troubleshooting

### Common Issues

**Cannot connect to Plex**
- Verify Plex is running and accessible
- Confirm Plex token is valid
- Check firewall rules

**Device not showing up**
- Ensure refresh interval is appropriate
- Check Plex server connection
- Verify device has attempted to stream

**Notifications not working**
- Test connection in Settings
- Verify SMTP/Apprise credentials
- Check email spam folder

### Viewing Logs

**Docker:**

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
```

**Proxmox:**

```bash
systemctl status guardian-backend
systemctl status guardian-frontend

# View detailed logs
journalctl -u guardian-backend -f
journalctl -u guardian-frontend -f
```

### Getting Help

If issues persist:

- Join our [Discord](https://discord.gg/xTKuHyhdS4) for community support
- Open an [Issue](https://github.com/HydroshieldMKII/Guardian/issues) with detailed information

---

## Contributing

We welcome contributions! Here's how you can help:

- **Report Bugs** - Open an issue with details and reproduction steps
- **Suggest Features** - Share your ideas in Discussions
- **Improve Documentation** - Submit PRs for README or docs improvements
- **Submit Code** - Fork, make changes, and submit a pull request

> **Note:** Please ensure your contributions follow the project's standards.
