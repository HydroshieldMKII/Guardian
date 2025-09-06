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
   docker compose up -d --build
   ```

4. **Access Guardian (Default Values)**:
   - Web Interface: http://localhost:3000
   - API: http://localhost:3001

## Update Guardian

> **WARNING ⚠️**
> Make sure to read the configuration section carefully after each update as new options may be added or existing ones modified. Also, make sure to backup your data before updating to avoid any potential data loss.

To update Guardian, pull the latest changes and rebuild the Docker containers:

```bash
git pull origin main
docker compose down
docker compose up -d --build
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

## Configuration

Edit the `.env` file with your Plex server details:

```bash
# Plex Server Configuration
PLEX_TOKEN=your_plex_token_here
PLEX_SERVER_IP=your_plex_server_ip
PLEX_SERVER_PORT=32400
USE_SSL=false #true or false

# Guardian Settings
PLEXGUARD_REFRESH_INTERVAL=10 # Refresh interval in seconds, lower value will make dashboard and actions more responsive
PLEX_GUARD_DEFAULT_BLOCK=true # Set to true to block new devices by default, false to auto-approve new devices
PLEXGUARD_STOPMSG="This device must be approved by the server owner."

# Port Configuration (Optional - defaults shown)
PLEXGUARD_API_PORT=3001        # Backend API port
PLEXGUARD_FRONTEND_PORT=3000   # Frontend web interface port

# Backend URL Configuration (Optional)
# Use this when accessing the frontend from outside your local network
# Examples:
#   PLEXGUARD_BACKEND_URL=http://192.168.1.100:3001
#   PLEXGUARD_BACKEND_URL=https://plexguard.your-domain.com
#   PLEXGUARD_BACKEND_URL=http://your-external-ip:3001
# If not set, defaults to http://localhost:${PLEXGUARD_API_PORT}
PLEXGUARD_BACKEND_URL=

# Docker Compose Build Performance (Optional)
COMPOSE_BAKE=true
```
## Issues

If you encounter any issues while using Guardian, please check the following:

- Ensure that your Plex server is running and accessible.
- Verify that your Plex authentication token is correct.
- Check the logs for any error messages.

If the problem persists, please open an issue on the [GitHub repository](https://github.com/HydroshieldMKII/Guardian/issues).

## Contributing

Contributions are welcome!
