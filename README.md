# Guardian

[![Build & Push to DockerHub](https://github.com/HydroshieldMKII/Guardian/actions/workflows/docker-multiarch.yml/badge.svg)](https://github.com/HydroshieldMKII/Guardian/actions/workflows/docker-multiarch.yml)
[![Docker Pulls (backend)](https://img.shields.io/docker/pulls/hydroshieldmkii/guardian-backend.svg)](https://hub.docker.com/r/hydroshieldmkii/guardian-backend)
[![Docker Pulls (frontend)](https://img.shields.io/docker/pulls/hydroshieldmkii/guardian-frontend.svg)](https://hub.docker.com/r/hydroshieldmkii/guardian-frontend)
[![GitHub Stars](https://img.shields.io/github/stars/HydroshieldMKII/Guardian.svg?style=flat)](https://github.com/HydroshieldMKII/Guardian/stargazers)
[![Discord](https://img.shields.io/discord/1415505445883215955?logo=discord&label=chat)](https://discord.gg/xTKuHyhdS4)


Guardian is a utility designed to enhance the security and management of your Plex Media Server. This tool is built to help users monitor and control access to their Plex server, ensuring that only authorized users can view and interact with their media library.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
   - [Docker (Recommended)](#quick-start-with-docker-recommended)
   - [Unraid](#unraid)
- [Update Guardian](#update-guardian)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

<img width="2568" height="1350" alt="list-b" src="https://github.com/user-attachments/assets/dc72f748-8202-4df1-8c2e-02223a8dcb20" />
<img width="2560" height="1350" alt="listd-b" src="https://github.com/user-attachments/assets/84f3114c-f78d-4c03-aaeb-45c8deb7c11b" />
<img width="2559" height="1349" alt="deviced-b" src="https://github.com/user-attachments/assets/38d37729-2a19-49f8-8736-217fa2500437" />
<img width="2556" height="1349" alt="active-stream-b" src="https://github.com/user-attachments/assets/229d0ed0-940d-4c31-b76c-4c2152b1b836" />


## Features

### **Device Security & Access Control**

- **Automatic session termination** - Automatically blocks streaming from unapproved devices
- **Per-user default blocking policies** - Configurable allow/block preferences for individual users and their devices
- **Global default blocking** - Set server-wide policy for new device detection

### **Real-time Monitoring & Tracking**

- **Live session monitoring** - Track all active Plex and Plexamp streams
- **Comprehensive device information** - Platform, product, version, IP address with quick lookup, and last seen timestamp
- **Stream monitoring** - Track title, quality, and duration of active streams

### **Configuration & Flexibility**

- **Configurable monitoring intervals** - Adjust real-time monitoring frequency
- **SSL/TLS support** - Secure connections with certificate validation options
- **Database persistence** - Support export and import of device data for backup and migration

## Installation


### Quick Start with Docker (Recommended)

The easiest way to deploy Guardian is using Docker Compose

### Prerequisites

- Docker and Docker Compose installed
- Plex Media Server running
- Plex authentication token

1. **Clone the repository**:

   ```bash
   git clone https://github.com/HydroshieldMKII/Guardian.git
   cd Guardian
   ```

2. **Setup configuration**:

   ```bash
   cp docker-compose.example.yml docker-compose.yml

   # Optionally, copy the .env file to customize environment variables
   cp .env.example .env
   ```

3. **Start the services**:

   ```bash
   docker compose up -d
   ```

4. **Access Guardian**:

With default port config, you can access the web interface at http://localhost:3000 or http://DEVICE-IP:3000

### Unraid

You can deploy Guardian on Unraid using the Compose Manager plugin:

#### Prerequisites

- Unraid server up and running
- Compose Manager plugin installed

#### Installation Steps

1. **Create a new stack**:
   - Navigate to Docker → Compose section
   - Click "Add New Stack"
   - Give it a descriptive name (e.g., "Guardian")

2. **Configure the stack**:
   - Click the gear icon next to your new stack
   - Select "Edit Stack" → "Compose File"
   - Copy the contents from [docker-compose.example.yml](./docker-compose.example.yml)
   - Paste the content into the text box

   You may need to adjust a few settings to fit your Unraid setup. Adjust the volume paths and ports as necessary in the configuration you just pasted.
   
   **Example volume mount adjustments:**

   If you want to store data in a specific location, modify the `volumes` section. Make sure it points to a valid path on your Unraid server.

   ```yaml
   # Default from docker-compose.example.yml:
   volumes:
     - backend_data:/app/data
   
   # Example for Unraid with custom path:
   volumes:
     - /mnt/user/appdata/guardian:/app/data
   ```

   **Example port adjustments:**

   if you need to change the port, you can do it by modifying the `ports` section.

   ```yaml
   # Default from docker-compose.example.yml:
   ports:
      - "${PLEXGUARD_FRONTEND_PORT:-3000}:3000"

   # Example for Unraid to use port 3456:
   ports:
      - "3456:3000"
   ```

   In this example, Guardian will be accessible on port `3456`

3. **Deploy**:
   - Click "Compose Up" to start the services

4. **Access Guardian**:
   - Open your browser and navigate to `http://[UNRAID-IP]:3000`


## Configuration

Guardian have 2 optionnals environments variables that you can set in a `.env` file to easily customize your deployment:

- `PLEXGUARD_FRONTEND_PORT`: The port on which the frontend will be accessible. Default is `3000`.
- `VERSION`: The version of Guardian to use. Default is `latest`.

To apply changes to the `.env` file, restart the Docker containers:

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
