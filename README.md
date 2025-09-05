# PlexGuard

PlexGuard is a utility designed to enhance the security and management of your Plex Media Server. This tool was built to help users monitor and control access to their Plex server, ensuring that only authorized users can view and interact with their media library.

## Features

- Deny streaming sessions from unapproved devices
- Manual device approval system
- Informations on devices like platform, product, version and IP address
- Tracks last seen active sessions and user activity, remove device access in one click

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
   docker-compose up -d --build
   ```

4. **Access PlexGuard**:
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
USE_SSL=false

# PlexGuard Settings
PLEXGUARD_REFRESH_INTERVAL=10
PLEXGUARD_STOPMSG="This device must be approved by the server owner."
```

## How It Works

1. **Device Approval**: New devices are automatically blocked until manually approved (Configurable)
2. **Session Management**: Monitor and control active streaming sessions
3. **Database Tracking**: SQLite database stores device information and approval status

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
