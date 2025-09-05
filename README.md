# PlexGuard

PlexGuard is a utility designed to enhance the security and management of your Plex Media Server. This tool is built to help users monitor and control access to their Plex server, ensuring that only authorized users can view and interact with their media library.

## Table of Contents

- [Features](#features)
- [Quick Start with Docker](#quick-start-with-docker)
- [Manual Development Setup](#manual-development-setup)
- [Configuration](#configuration)
- [Port Configuration](#port-configuration)
- [Contributing](#contributing)

## Features

- Deny streaming sessions from unapproved devices
- Manual device approval system
- Informations on devices like platform, product, version and IP address
- Tracks last seen active sessions and user activity, with the ability to remove per device access in one click
- Support Plex SSL

<img width="2558" height="1188" alt="plexguard1_" src="https://github.com/user-attachments/assets/d6994f2b-317b-4cdb-83eb-77fb9ce2bcdc" />
<img width="2558" height="1191" alt="plexguard2_" src="https://github.com/user-attachments/assets/1f3e6286-7ee4-4361-9896-548edc00ed7f" />
<img width="2558" height="1191" alt="plexguard3_" src="https://github.com/user-attachments/assets/2c6d7de2-3791-48cf-b8c7-25dca5babc6c" />
<img width="2558" height="1192" alt="plexguard4_" src="https://github.com/user-attachments/assets/3f04c716-7e8b-4d08-9de6-fb1e89069ded" />


## 🚀 Quick Start with Docker (Recommended)

The easiest way to deploy PlexGuard is using Docker Compose:

### Prerequisites

- Docker and Docker Compose installed
- Plex Media Server running
- Plex authentication token

### Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/HydroshieldMKII/PlexGuard.git
   cd PlexGuard
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

4. **Access PlexGuard (Default Ports)**:
   - Web Interface: http://localhost:3000
   - API: http://localhost:3001
   - Plex Proxy: http://localhost:8080

## 🛠 Manual Development Setup

If you prefer to run PlexGuard without Docker:

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

# PlexGuard Settings
PLEXGUARD_REFRESH_INTERVAL=10 # Refresh interval in seconds, lower value will make dashboard and actions more responsive
PLEX_GUARD_DEFAULT_BLOCK=true # Set to true to block new devices by default, false to auto-approve new devices
PLEXGUARD_STOPMSG="This device must be approved by the server owner."

# Port Configuration (Optional - defaults shown)
PLEXGUARD_API_PORT=3001        # Backend API port
PLEXGUARD_FRONTEND_PORT=3000   # Frontend web interface port
PLEXGUARD_PROXY_PORT=8080      # Plex proxy port

# Docker Compose Build Performance (Optional)
COMPOSE_BAKE=true
```

## Port Configuration

PlexGuard uses three configurable ports:

- **PLEXGUARD_FRONTEND_PORT** (default: 3000): Frontend web interface port.
- **PLEXGUARD_API_PORT** (default: 3001): Backend API server port
- **PLEXGUARD_PROXY_PORT** (default: 8080): Plex proxy server port

You can customize these ports in your `.env` file to avoid conflicts with other services or to match your preferred configuration. The frontend port and backend port should be publicly accessible.

## Contributing

Contributions are welcome!
