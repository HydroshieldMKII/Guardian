# Guardian

Guardian is a utility designed to enhance the security and management of your Plex Media Server. This tool is built to help users monitor and control access to their Plex server, ensuring that only authorized users can view and interact with their media library.

## Table of Contents

- [Features](#features)
- [Quick Start with Docker](#-quick-start-with-docker-recommended)
- [Update Guardian](#update-guardian)
- [Manual Development Setup](#-manual-development-setup)
- [Configuration](#configuration)
- [Issues](#issues)
- [Contributing](#contributing)

## Features

- Deny streaming sessions from unapproved devices
- Manual device approval system
- Informations on devices like platform, product, version and IP address
- Tracks last seen active sessions and user activity, with the ability to remove per device access in one click

<img width="2558" height="1188" alt="Guardian Dashboard" src="https://github.com/user-attachments/assets/d6994f2b-317b-4cdb-83eb-77fb9ce2bcdc" />
<img width="2558" height="1191" alt="Guardian Dashboard" src="https://github.com/user-attachments/assets/1f3e6286-7ee4-4361-9896-548edc00ed7f" />
<img width="2558" height="1191" alt="Guardian Dashboard" src="https://github.com/user-attachments/assets/2c6d7de2-3791-48cf-b8c7-25dca5babc6c" />
<img width="2558" height="1192" alt="Guardian Dashboard" src="https://github.com/user-attachments/assets/3f04c716-7e8b-4d08-9de6-fb1e89069ded" />

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

## Update Guardian

> **WARNING ⚠️**
> Make sure to read the configuration section carefully after each update as new options may be added or existing ones modified. Also, make sure to backup your data before updating to avoid any potential data loss.

To update Guardian, pull the latest changes and restart the Docker containers:

```bash
docker compose pull
docker compose up -d
```

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
PLEXGUARD_API_PORT=3001

# Backend URL Configuration (Optional)
# Use this to specify a custom backend URL when accessing from outside the network
# Examples: 
#   http://your-domain.com:3001
#   https://plexguard.your-domain.com
#   http://192.168.1.100:3001
# If not set, defaults to http://localhost:${PLEXGUARD_API_PORT}
PLEXGUARD_BACKEND_URL=

```

If you already have Guardian running and want to change the configuration, simply update the `.env` file and restart the services:

```bash
docker compose up -d --force-recreate
```

## 🛠 Manual Development Setup

If you prefer to run Guardian without Docker:

### Prerequisites

- Node.js 18+ and npm
- Plex Media Server running
- Plex authentication token

### Backend Setup

```bash
cd backend
npm install
npm run start:dev
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```
## Troubleshooting

If you encounter issues, ensure that:
- Your Plex server is running and accessible.
- Your Plex authentication token is correct.
- Check the logs for any error messages in both browser console and containers.

You can check the logs of the backend container with:

```bash
docker compose logs -f backend
```

If the problem persists, please open an issue on the [GitHub repository](https://github.com/HydroshieldMKII/Guardian/issues).

## Contributing

Contributions are welcome!
