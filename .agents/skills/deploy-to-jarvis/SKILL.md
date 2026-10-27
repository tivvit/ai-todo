---
name: deploy-to-jarvis
description: >-
  Guides deploying, updating, and managing Docker services on the Jarvis server.
  Use when adding new applications, editing docker-compose configurations, building images,
  or restarting services managed via /data/var/docker-compose.yml on Jarvis.
---

# Deploy to Jarvis Skill Guide

This server is **Jarvis** (`hostname: jarvis`). All central containerized applications and services are orchestrated via Docker Compose located at `/data/var/docker-compose.yml`.

---

## 1. Core Conventions & Layout

| Component | Path / Convention | Description |
| :--- | :--- | :--- |
| **Compose File** | `/data/var/docker-compose.yml` | Central orchestration file for all persistent Jarvis services. |
| **Persistent Data** | `/data/var/<service_name>/` | Host directory mounted into containers for state, databases, and configs. |
| **Reverse Proxy** | Traefik | Inspects container labels and routes `http://<service>.jarvis.lan` to internal ports. |
| **Timezone** | `TZ=Europe/Zurich` | Standard environment timezone. |
| **Restart Policy** | `restart: unless-stopped` | Default for standard application services. |

---

## 2. Standard Service Deployment Workflow

When deploying a new application or service to Jarvis:

### Step 1: Build Image (if custom or local)
```bash
docker build -t <service-name>:latest /data/git/<service-name>
```

### Step 2: Create Data Volume Directory
Ensure the persistent data path exists on the host:
```bash
mkdir -p /data/var/<service-name>
```

### Step 3: Add Service Definition to `/data/var/docker-compose.yml`
Append the service block under `services:` in `/data/var/docker-compose.yml`. Example:

```yaml
  <service-name>:
    image: <service-name>:latest
    container_name: <service-name>
    restart: unless-stopped
    ports:
      - "<host_port>:<container_port>"
    environment:
      - NODE_ENV=production
      - TZ=Europe/Zurich
    volumes:
      - /data/var/<service-name>:/app/data
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.<service-name>.rule=Host(`<service-name>.jarvis.lan`)"
      - "traefik.http.routers.<service-name>.entrypoints=web"
      - "traefik.http.services.<service-name>.loadbalancer.server.port=<container_port>"
```

### Step 4: Deploy / Start Service
```bash
docker compose -f /data/var/docker-compose.yml up -d <service-name>
```

### Step 5: Verify Health & Logs
```bash
# Verify container is running
docker ps -f name=<service-name>

# Check service startup logs
docker compose -f /data/var/docker-compose.yml logs --tail 50 <service-name>
```

---

## 3. Best Practices on Jarvis

1. **Port Conflicts:** Check port availability with `ss -tuln | grep <port>` before choosing a host port mapping.
2. **OpenClaw Integration:** If a service requires Todoist or other agent credentials, read from `/data/var/openclaw/workspace/config/mcporter.json` or mount it read-only.
3. **No-Downtime Updates:** When updating an existing service, use `docker compose -f /data/var/docker-compose.yml up -d --no-deps <service-name>` to recreate only that specific container without touching other running services.
