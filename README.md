# PlexGuard

PlexGuard is a utility designed to enhance the security and management of your Plex Media Server. This tool is built to help users monitor and control access to their Plex server, ensuring that only authorized users can view and interact with their media library.

## Features

- Deny streaming sessions from unapproved devices
- Manual device approval system
- Informations on devices like platform, product, version and IP address
- Tracks last seen active sessions and user activity, with the ability to remove per device access in one click

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

2. **Quick setup with the management script**:

   ```bash
   ./docker-manage.sh setup
   ./docker-manage.sh start
   ```

3. **Or manually**:

   ```bash
   cp .env.example .env
   # Edit .env with your Plex server details
   nano .env
   docker compose up -d --build
   ```

4. **Access PlexGuard**:
   - Web Interface: http://localhost:{PLEXGUARD_FRONTEND_PORT} (default: 3000)
   - API: http://localhost:{PLEXGUARD_API_PORT} (default: 3001)
   - Plex Proxy: http://localhost:{PLEXGUARD_PROXY_PORT} (default: 8080)

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
USE_SSL=false

# PlexGuard Settings
PLEXGUARD_REFRESH_INTERVAL=10
PLEXGUARD_STOPMSG="This device must be approved by the server owner."

# Port Configuration (Optional - defaults shown)
PLEXGUARD_API_PORT=3001        # Backend API port
PLEXGUARD_FRONTEND_PORT=3000   # Frontend web interface port
PLEXGUARD_PROXY_PORT=8080      # Plex proxy port
```

## Port Configuration

PlexGuard uses three configurable ports:

- **PLEXGUARD_API_PORT** (default: 3001): Backend API server port
- **PLEXGUARD_FRONTEND_PORT** (default: 3000): Frontend web interface port  
- **PLEXGUARD_PROXY_PORT** (default: 8080): Plex proxy server port

You can customize these ports in your `.env` file to avoid conflicts with other services or to match your preferred configuration.

## Contributing

Contributions are welcome!
