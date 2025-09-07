# Guardian

Guardian is a utility designed to enhance the security and management of your Plex Media Server. This tool is built to help users monitor and control access to their Plex server, ensuring that only authorized users can view and interact with their media library.

## Table of Contents

- [Features](#features)
- [Quick Start with Docker](#-quick-start-with-docker-recommended)
- [Configuration](#configuration)
- [Update Guardian](#update-guardian)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Features

- Deny streaming sessions from unapproved devices
- Manual device approval system
- Informations on devices like platform, product, version and IP address
- Tracks last seen active sessions and user activity, with the ability to remove per device access in one click

<img width="2558" height="1237" alt="1" src="https://github.com/user-attachments/assets/0cd179aa-2bb3-4100-a000-c99ce2f985c8" />
<img width="2558" height="1232" alt="2" src="https://github.com/user-attachments/assets/0c00c7cb-a0ed-4965-b931-a6f18f369440" />
<img width="2558" height="1236" alt="3" src="https://github.com/user-attachments/assets/2a976d66-e9bd-44d5-a09d-cffe8842f129" />
<img width="2558" height="1237" alt="4" src="https://github.com/user-attachments/assets/1d188e2e-100f-4d99-a1f4-7c22347a51df" />
<img width="2556" height="1235" alt="5" src="https://github.com/user-attachments/assets/5775eab2-972c-4093-a7a2-fc23cd56a389" />

## 🚀 Quick Start with Docker (Recommended)

The easiest way to deploy Guardian is using Docker Compose:

### Prerequisites

- Docker and Docker Compose installed
- Plex Media Server running
- Plex authentication token

### Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/HydroshieldMKII/Guardian.git
   cd Guardian
   ```

2. **Setup environment variables**:

   ```bash
   cp .env.example .env
   nano .env # Edit .env with your Plex server details
   ```

3. **Start the services**:

   ```bash
   docker compose up -d
   ```

4. **Access Guardian (Default Values)**:
   - Web Interface: http://localhost:3000
   - API: http://localhost:3001

or if you use a container management system like Portainer, you can pull the images manually with the following commands:

```bash
docker pull hydroshieldmkii/guardian-backend
docker pull hydroshieldmkii/guardian-frontend
```

don't forget to set the environment variables in your container management system.

## Configuration

Edit the `.env` file with your Plex server details:

```bash
# Plex Server Configuration
PLEX_TOKEN=plex_token_here #https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/
PLEX_SERVER_IP=server_ip_here
PLEX_SERVER_PORT=32400
USE_SSL=false # Set to true if your Plex server uses SSL

# Guardian Configuration
PLEXGUARD_REFRESH_INTERVAL=10 # Interval in seconds to refresh the device list from Plex and block devices
PLEX_GUARD_DEFAULT_BLOCK=true # Set to true to block unapproved devices by default
PLEXGUARD_STOPMSG="This device must be approved by the server owner. Please contact the server administrator for more information."
VERSION=latest

# Port Configuration
PLEXGUARD_FRONTEND_PORT=3000
```

If you already have Guardian running and want to change the configuration, simply update the `.env` file and restart the services:

```bash
docker compose up -d --force-recreate
```

## Update Guardian

> **WARNING ⚠️**
> Make sure to read the configuration section carefully after each update as new options may be added or existing ones modified. Also, make sure to backup your data before updating to avoid any potential data loss.

To update Guardian, pull the latest changes and restart the Docker containers:

```bash
docker compose pull
docker compose up -d
```

## Troubleshooting

If you encounter issues, ensure that:

- Your Plex server is running and accessible.
- Your Plex authentication token is correct.
- Check the logs for any error messages in both browser console and containers.

You can check container status with:

```bash
docker compose ps
```

You can check the logs of the backend container with:

```bash
docker compose logs -f backend
```

If the problem persists, please open an issue on the [GitHub repository](https://github.com/HydroshieldMKII/Guardian/issues).

## Contributing

Contributions are welcome!
