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
<img width="2558" height="1233" alt="3" src="https://github.com/user-attachments/assets/ad0c1da3-2ee5-431d-a893-98aa40cd3565" />
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

2. **Setup configuration**:

   ```bash
   cp docker-compose.example.yml docker-compose.yml
   cp .env.example .env
   ```

3. **Start the services**:

   ```bash
   docker compose up -d
   ```

4. **Access Guardian**:

With default port config, you can access the web interface at http://localhost:3000 or http://device-ip:3000

### Manually pull image

If you use a container management system like Portainer, you can pull the images manually with the following commands:

```bash
docker pull hydroshieldmkii/guardian-backend
docker pull hydroshieldmkii/guardian-frontend
```

## Update Guardian

> **WARNING ⚠️**
> Make sure to read the configuration section carefully after each update as new options may be added or existing ones modified. Also, make sure to backup your data before updating to avoid any potential data loss.

To update Guardian, pull the latest changes and restart the Docker containers:

```bash
docker compose pull
docker compose up -d
```

## Configuration

Guardian have 2 optionnals environments variables that you can set in a `.env` file:

- `PLEXGUARD_FRONTEND_PORT`: The port on which the frontend will be accessible. Default is `3000`.
- `VERSION`: The version of Guardian to use. Default is `latest`.

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
