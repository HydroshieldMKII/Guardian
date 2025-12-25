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
  - [Password Recovery](#password-recovery)
  - [Common Issues](#common-issues)
  - [Viewing Logs](#viewing-logs)
  - [Getting Help](#getting-help)
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
# Create a directory for Guardian
mkdir -p guardian && cd guardian

# Download configuration files
curl -o docker-compose.yml https://raw.githubusercontent.com/HydroshieldMKII/Guardian/main/docker-compose.example.yml
curl -o .env https://raw.githubusercontent.com/HydroshieldMKII/Guardian/main/.env.example

# Start Guardian
docker compose up -d
```

**Access Guardian**

- Local: [http://localhost:3000](http://localhost:3000)
- Remote: `http://YOUR-SERVER-IP:3000`

**Build from Source**

```bash
# Clone the repository
git clone https://github.com/HydroshieldMKII/Guardian.git
cd Guardian

# Start Guardian with build
docker compose -f docker-compose.dev.yml up -d --build
```

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

> [!NOTE]
> For detailed Proxmox configuration options, see the [community script documentation](https://community-scripts.github.io/ProxmoxVE/scripts?id=guardian).

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

| Variable                  | Description          | Default  | Applies To              |
| ------------------------- | -------------------- | -------- | ----------------------- |
| `PLEXGUARD_FRONTEND_PORT` | Web interface port   | `3000`   | Docker, Proxmox, Unraid |
| `VERSION`                 | Docker image version | `latest` | Docker, Unraid          |

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

> [!IMPORTANT]
> Most configuration is done through Guardian's web interface. Environment variables are primarily for deployment customization.

---

## Application Settings

Configure Guardian through the web interface Settings page.

### Plex Integration

Connect Guardian to your Plex Media Server to enable session monitoring and device management.

| Setting                           | Description                                                                                                                                                                                               | Default  |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **Plex Server IP**                | The IP address or hostname where your Plex Media Server is running (e.g., `192.168.1.100` or `plex.local`)                                                                                                | -        |
| **Plex Server Port**              | The port number your Plex server listens on for API requests                                                                                                                                              | `32400`  |
| **Plex Authentication Token**     | Your Plex authentication token required for Guardian to communicate with your server ([How to find your token](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/)) | -        |
| **Use SSL/HTTPS**                 | Connect to your Plex server using encrypted HTTPS instead of unencrypted HTTP                                                                                                                             | Disabled |
| **Ignore SSL Certificate Errors** | Skip SSL certificate validation when connecting to Plex (useful for self-signed certificates, but not recommended for production environments)                                                            | Disabled |
| **Custom Plex URL**               | Override the default Plex URL used when opening media links (e.g., `https://app.plex.tv` or your custom domain)                                                                                           | -        |

### Guardian Configuration

Core security behavior, monitoring settings, and access control options.

| Setting                            | Description                                                                                                                                                                                                     | Default  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **Auto-Check Updates**             | Automatically check for new Guardian releases when the application starts and notify you of available updates                                                                                                   | Enabled  |
| **Block New Devices**              | Automatically block streaming access for all newly detected devices until they are manually approved by an administrator                                                                                        | Enabled  |
| **Strict Mode**                    | Automatically approve or reject new devices based on the default blocking policy. Existing pending devices will also be affected by this setting                                                                | Disabled |
| **Session Refresh Interval**       | How frequently Guardian checks for active Plex sessions and enforces access rules (in seconds). Lower values provide faster response but increase server load. It have no effect on the dashboard refresh rate. | `10`     |
| **Global Concurrent Stream Limit** | Maximum number of simultaneous streams allowed per user across all their devices (set to `0` for unlimited streams). Make sure that plex is set to unlimited in its own settings to avoid conflicts.            | `0`      |
| **Include Temp Access in Limit**   | When enabled, devices with temporary access are counted towards the user's concurrent stream limit                                                                                                              | Disabled |
| **Auto Device Cleanup**            | Automatically remove devices that haven't been seen for a specified period to keep your device list clean                                                                                                       | Disabled |
| **Cleanup Threshold (Days)**       | Number of days of inactivity before a device is automatically removed when auto cleanup is enabled                                                                                                              | `30`     |
| **Timezone**                       | UTC offset used for time-based access restrictions and scheduling (e.g., `+00:00`, `-05:00`, `+05:30`)                                                                                                          | `+00:00` |

#### User Portal Settings

Configure the self-service portal that allows Plex users to view and manage their own devices.

| Setting                             | Description                                                                                                                                              | Default |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| **Enable User Portal**              | Allow Plex users to log in with their Plex credentials and view their registered devices. When disabled, Plex login only works for admin-linked accounts | Enabled |
| **Show Rules in Portal**            | Allow Plex users to see the access rules assigned to them, including network policies, concurrent stream limits, and time-based restrictions             | Enabled |
| **Allow Notes on Rejected Devices** | Allow Plex users to submit notes or access requests for devices that have been rejected, which administrators can review                                 | Enabled |

### Customization

Personalize the user interface and customize messages shown to users.

| Setting                   | Description                                                                                                          | Default   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------- |
| **Default Page**          | The page displayed when Guardian first opens (`Devices` to show device management, or `Streams` for active sessions) | `Devices` |
| **Show Media Thumbnails** | Display thumbnail preview images for currently streaming media in the active streams view                            | Enabled   |
| **Show Media Artwork**    | Display background artwork and poster images for media in the streams interface                                      | Enabled   |

#### Custom Blocking Messages

Customize the messages displayed to users when their streaming access is blocked for various reasons:

| Message Type         | Description                                                                                          | Default Message                         |
| -------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **Device Pending**   | Message shown when a device is waiting for administrator approval before it can stream               | "Your device is pending approval"       |
| **Device Rejected**  | Message shown when a device has been explicitly rejected and cannot stream                           | "Your device has been rejected"         |
| **Time Restricted**  | Message shown when streaming is blocked because the current time falls outside allowed hours         | "Streaming is not allowed at this time" |
| **Concurrent Limit** | Message shown when a user exceeds their maximum allowed simultaneous streams                         | "You have reached your stream limit"    |
| **LAN Only**         | Message shown when a device can only stream from the local network but is connecting remotely        | "This device can only stream from LAN"  |
| **WAN Only**         | Message shown when a device can only stream from outside the local network but is connecting locally | "This device can only stream from WAN"  |
| **IP Not Allowed**   | Message shown when the device's IP address is not in the configured allowed IP list or CIDR range    | "Your IP address is not allowed"        |

### Notification Settings

Configure how Guardian delivers notifications about security events and device activity.

#### In-App Notifications

| Setting                         | Description                                                                                                  | Default  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| **Enable In-App Notifications** | Master switch to enable or disable all in-app notifications within the Guardian interface                    | Enabled  |
| **Notify on New Device**        | Show an in-app notification when a new device is detected attempting to stream from your Plex server         | Enabled  |
| **Notify on Block**             | Show an in-app notification when a stream is terminated due to access rules or policy violations             | Enabled  |
| **Notify on Location Change**   | Show an in-app notification when a device's IP address changes, which may indicate the device moved networks | Disabled |
| **Notify on Device Note**       | Show an in-app notification when a Plex user submits a note or access request for one of their devices       | Enabled  |
| **Auto-Mark as Read**           | Automatically mark notifications as read when you click on them, rather than requiring manual dismissal      | Enabled  |

#### Email Notifications (SMTP)

Send email alerts for important Guardian events using your SMTP server.

| Setting                        | Description                                                                                                 | Default                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------ |
| **Enable Email Notifications** | Master switch to enable the SMTP email notification system                                                  | Disabled                 |
| **Notify on New Device**       | Send an email alert when a new device is detected attempting to stream from your Plex server                | Disabled                 |
| **Notify on Block**            | Send an email alert when a stream is terminated due to access rules or policy violations                    | Disabled                 |
| **Notify on Location Change**  | Send an email alert when a device's IP address changes, which may indicate suspicious activity              | Disabled                 |
| **Notify on Device Note**      | Send an email alert when a Plex user submits a note or access request for one of their devices              | Disabled                 |
| **SMTP Host**                  | Hostname or IP address of your SMTP mail server (e.g., `smtp.gmail.com`, `smtp.office365.com`)              | -                        |
| **SMTP Port**                  | Port number for SMTP connection (common ports: `587` for TLS/STARTTLS, `465` for SSL, `25` for unencrypted) | `587`                    |
| **SMTP Username**              | Username for authenticating with your SMTP server (often your email address)                                | -                        |
| **SMTP Password**              | Password or app-specific password for SMTP authentication                                                   | -                        |
| **Use TLS**                    | Enable TLS/STARTTLS encryption for secure email transmission (recommended for most providers)               | Enabled                  |
| **From Email**                 | Email address that will appear as the sender of Guardian notifications                                      | -                        |
| **From Name**                  | Display name that will appear as the sender (e.g., "Guardian Alerts")                                       | `Guardian Notifications` |
| **To Emails**                  | Recipient email addresses for notifications (separate multiple addresses with commas or semicolons)         | -                        |

#### Apprise Notifications

Send notifications to 100+ services including Discord, Slack, Telegram, Pushover, and many more using the Apprise notification library.

| Setting                       | Description                                                                                             | Default  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- | -------- |
| **Enable Apprise**            | Master switch to enable the Apprise multi-service notification system                                   | Disabled |
| **Notify on New Device**      | Send an Apprise notification when a new device is detected attempting to stream from your Plex server   | Disabled |
| **Notify on Block**           | Send an Apprise notification when a stream is terminated due to access rules or policy violations       | Disabled |
| **Notify on Location Change** | Send an Apprise notification when a device's IP address changes, which may indicate suspicious activity | Disabled |
| **Notify on Device Note**     | Send an Apprise notification when a Plex user submits a note or access request for one of their devices | Disabled |
| **Service URLs**              | Your notification service URLs in Apprise format (one per line, or separated by commas/semicolons)      | -        |

> [!NOTE]
> Each notification service has a specific URL format. View the [Apprise documentation](https://github.com/caronc/apprise/wiki) for supported services and URL configuration examples.

### Admin Tools

#### Database Management

Backup and restore your Guardian configuration, devices, and settings.

| Action              | Description                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Export Database** | Download a complete JSON backup containing all settings, registered devices, user preferences, and notification history |
| **Import Database** | Restore configuration from a previously exported backup file (merges with existing data without deleting records)       |

> [!WARNING]
> Database exports contain sensitive information including your Plex authentication token, SMTP credentials, and Apprise service URLs. Store backup files securely and never share them publicly.

#### Administrative Tools & Dangerous Operations

> [!CAUTION]
> These operations can permanently modify or delete data. Always export your database before performing any administrative operations.

| Tool                      | Description                                                              | Impact                                                                                |
| ------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| **Reset Stream Counts**   | Clear all session statistics and stream counters for all devices         | Device records and settings are preserved; only streaming statistics are reset        |
| **Clear Session History** | Permanently delete all historical session records from the database      | Cannot be undone; active sessions are not affected                                    |
| **Delete All Devices**    | Remove all registered device records from Guardian                       | All users will need to re-register; also deletes associated notifications and history |
| **Reset Database**        | Complete factory reset that wipes all data and restores default settings | Cannot be undone; you will need to reconfigure Guardian from scratch                  |

---

## Updating

> [!IMPORTANT]
> Always backup your database before updating (Settings → Admin Tools → Export Database).

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

### Password Recovery

If you've lost access to your admin account, you can reset credentials from the command line.

#### Docker

All commands are run next to the `docker-compose.yml` file.

**List all admin users:**

```bash
docker compose exec backend node src/scripts/list-admins.js
```

**Reset admin password:**

```bash
docker compose exec backend node src/scripts/update-admin.js "USERNAME_HERE" "NEW_PASSWORD_HERE"
```

Replace `USERNAME_HERE` with your admin username and `NEW_PASSWORD_HERE` with your desired password.

#### Proxmox (LXC)

All commands are run from inside the LXC container.

**List all admin users:**

```bash
node /opt/guardian/backend/src/scripts/list-admins.js
```

**Reset admin password:**

```bash
node /opt/guardian/backend/src/scripts/update-admin.js "USERNAME_HERE" "NEW_PASSWORD_HERE"
```

Replace `USERNAME_HERE` with your admin username and `NEW_PASSWORD_HERE` with your desired password.

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

> [!NOTE]
> Please ensure your contributions follow the project's standards.
